import {
  type Listing,
  type ListingReport,
  type ListingSummary,
  type marketContract,
  type Order,
  type OrderStatus,
  type OrderSummary,
  parseModuleSettings,
  type RouteBody,
  type RouteQuery,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import { decodeCursor, slicePage } from '../../common/util/pagination';
import type { Prisma } from '../../generated/prisma/client';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { loadMemberNames } from '../tenancy/member-names';

type C = typeof marketContract;
type ListingBody = RouteBody<C['createListing']>;
type ListingPatch = RouteBody<C['updateListing']>;

const listingInclude = {
  images: { orderBy: { sortOrder: 'asc' } },
} as const satisfies Prisma.ListingInclude;
type ListingRow = Prisma.ListingGetPayload<{ include: typeof listingInclude }>;

const orderInclude = {
  listing: { include: listingInclude },
  messages: { orderBy: { createdAt: 'asc' } },
  review: true,
} as const satisfies Prisma.MarketOrderInclude;
type OrderRow = Prisma.MarketOrderGetPayload<{ include: typeof orderInclude }>;

const OPEN: OrderStatus[] = ['REQUESTED', 'ACCEPTED', 'READY'];
/** Food that was ready more than 12 hours ago drops out of the market by itself. */
const FOOD_SHELF_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class MarketService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  private settings(ctx: TenantContext) {
    return parseModuleSettings('marketplace', ctx.moduleSettings.marketplace);
  }

  // ---------------------------------------------------------------- listings

  async list(query: RouteQuery<C['listListings']>) {
    const ctx = requireTenant();
    const cursor = decodeCursor(query.cursor);
    const now = new Date();
    const s = this.settings(ctx);
    const hiddenKinds = [
      ...(s.foodEnabled ? [] : (['FOOD'] as const)),
      ...(s.resaleEnabled ? [] : (['RESALE'] as const)),
    ];
    const rows = await this.db.listing.findMany({
      where: {
        status: 'ACTIVE',
        kind: query.kind
          ? (hiddenKinds as string[]).includes(query.kind)
            ? { in: [] }
            : query.kind
          : { notIn: [...hiddenKinds] },
        ...(query.q ? { title: { contains: query.q, mode: 'insensitive' } } : {}),
        AND: [
          {
            OR: [{ readyAt: null }, { readyAt: { gte: new Date(now.getTime() - FOOD_SHELF_MS) } }],
          },
          cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.at } },
                  { createdAt: cursor.at, id: { lt: cursor.id } },
                ],
              }
            : {},
        ],
      },
      include: listingInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = slicePage(rows, query.limit);
    return { items: await this.summaries(ctx, page.items), nextCursor: page.nextCursor };
  }

  async mine(): Promise<ListingSummary[]> {
    const ctx = requireTenant();
    const rows = await this.db.listing.findMany({
      where: { sellerMembershipId: ctx.membershipId, status: { not: 'ARCHIVED' } },
      include: listingInclude,
      orderBy: [{ createdAt: 'desc' }],
    });
    return this.summaries(ctx, rows);
  }

  async get(listingId: string): Promise<Listing> {
    const ctx = requireTenant();
    const row = await this.requireListing(listingId);
    const mine = row.sellerMembershipId === ctx.membershipId;
    const moderator = can(ctx, 'marketplace.moderate');
    if ((row.status === 'HIDDEN' || row.status === 'ARCHIVED') && !mine && !moderator)
      throw ApiException.notFound('Listing not found');
    if (row.status === 'PAUSED' && !mine && !moderator) {
      // A buyer with an open order can still open the listing it came from.
      const open = await this.db.marketOrder.count({
        where: { listingId, buyerMembershipId: ctx.membershipId, status: { in: OPEN } },
      });
      if (!open) throw ApiException.notFound('Listing not found');
    }
    return this.detail(ctx, row);
  }

  async create(body: ListingBody): Promise<Listing> {
    const ctx = requireTenant();
    const data = this.validate(ctx, body);
    const imageIds = await this.requireOwnImages(ctx, body.imageIds);
    const row = await this.prisma.$transaction(async (tx) => {
      const l = await tx.listing.create({
        data: {
          ...data,
          societyId: ctx.societyId,
          sellerMembershipId: ctx.membershipId,
          images: {
            create: imageIds.map((fileId, i) => ({
              fileId,
              societyId: ctx.societyId,
              sortOrder: i,
            })),
          },
        },
        include: listingInclude,
      });
      await tx.storedFile.updateMany({
        where: { id: { in: imageIds }, societyId: ctx.societyId },
        data: { attachedAt: new Date() },
      });
      return l;
    });
    return this.detail(ctx, row);
  }

  async update(listingId: string, patch: ListingPatch): Promise<Listing> {
    const ctx = requireTenant();
    const before = await this.requireOwnListing(ctx, listingId);
    if (before.status === 'HIDDEN')
      throw ApiException.forbidden('A moderator took this listing down');
    const merged: ListingBody = {
      kind: patch.kind ?? before.kind,
      title: patch.title ?? before.title,
      description: patch.description !== undefined ? patch.description : before.description,
      priceType: patch.priceType ?? before.priceType,
      pricePaise: patch.pricePaise !== undefined ? patch.pricePaise : before.pricePaise,
      unit: patch.unit !== undefined ? patch.unit : before.unit,
      diet: patch.diet !== undefined ? patch.diet : before.diet,
      quantityAvailable:
        patch.quantityAvailable !== undefined ? patch.quantityAvailable : before.quantityAvailable,
      readyAt:
        patch.readyAt !== undefined ? patch.readyAt : (before.readyAt?.toISOString() ?? null),
      orderBy:
        patch.orderBy !== undefined ? patch.orderBy : (before.orderBy?.toISOString() ?? null),
      fulfilment: patch.fulfilment ?? before.fulfilment,
      condition: patch.condition !== undefined ? patch.condition : before.condition,
      imageIds: patch.imageIds ?? before.images.map((i) => i.fileId),
      visibility: patch.visibility ?? before.visibility,
      showPhoneAfterAccept: patch.showPhoneAfterAccept ?? before.showPhoneAfterAccept,
    };
    const data = this.validate(ctx, merged);
    const oldIds = before.images.map((i) => i.fileId);
    const keep = new Set(oldIds);
    const newIds = patch.imageIds
      ? await this.requireOwnImages(
          ctx,
          patch.imageIds.filter((id) => !keep.has(id)),
        )
      : [];
    const finalIds = patch.imageIds ?? oldIds;
    const dropped = oldIds.filter((id) => !finalIds.includes(id));
    const row = await this.prisma.$transaction(async (tx) => {
      if (patch.imageIds) {
        await tx.listingImage.deleteMany({ where: { listingId } });
        await tx.listingImage.createMany({
          data: finalIds.map((fileId, i) => ({
            listingId,
            fileId,
            societyId: ctx.societyId,
            sortOrder: i,
          })),
        });
        if (newIds.length)
          await tx.storedFile.updateMany({
            where: { id: { in: newIds }, societyId: ctx.societyId },
            data: { attachedAt: new Date() },
          });
      }
      return tx.listing.update({
        where: { id: listingId, societyId: ctx.societyId },
        data,
        include: listingInclude,
      });
    });
    await this.files.remove(dropped);
    return this.detail(ctx, row);
  }

  async setStatus(listingId: string, status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED'): Promise<Listing> {
    const ctx = requireTenant();
    const before = await this.requireOwnListing(ctx, listingId);
    if (before.status === 'HIDDEN')
      throw ApiException.forbidden('A moderator took this listing down');
    const row = await this.db.listing.update({
      where: { id: listingId },
      data: { status },
      include: listingInclude,
    });
    return this.detail(ctx, row);
  }

  async report(listingId: string, reason: string): Promise<void> {
    const ctx = requireTenant();
    const row = await this.requireListing(listingId);
    if (row.sellerMembershipId === ctx.membershipId)
      throw ApiException.badRequest('VALIDATION_FAILED', 'You cannot report your own listing');
    const open = await this.db.listingReport.findFirst({
      where: { listingId, reporterMembershipId: ctx.membershipId, status: 'OPEN' },
    });
    if (open) return;
    await this.db.listingReport.create({
      data: {
        societyId: ctx.societyId,
        listingId,
        reporterMembershipId: ctx.membershipId,
        reason,
      },
    });
  }

  // -------------------------------------------------------------- moderation

  async reports(): Promise<ListingReport[]> {
    const ctx = requireTenant();
    const rows = await this.db.listingReport.findMany({
      where: { status: 'OPEN' },
      include: { listing: { include: listingInclude } },
      orderBy: { createdAt: 'asc' },
    });
    const names = await loadMemberNames(
      this.prisma,
      rows.map((r) => r.reporterMembershipId),
    );
    const summaries = await this.summaries(
      ctx,
      rows.map((r) => r.listing),
    );
    return rows.map((r, i) => ({
      id: r.id,
      listing: summaries[i] as ListingSummary,
      reason: r.reason,
      reportedBy: names.get(r.reporterMembershipId)?.displayName ?? '',
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async hide(listingId: string, reason: string): Promise<Listing> {
    const ctx = requireTenant();
    const before = await this.requireListing(listingId);
    const { row, cancelled } = await this.prisma.$transaction(async (tx) => {
      const open = await tx.marketOrder.findMany({
        where: { listingId, societyId: ctx.societyId, status: { in: OPEN } },
      });
      await tx.marketOrder.updateMany({
        where: { listingId, societyId: ctx.societyId, status: { in: OPEN } },
        data: { status: 'CANCELLED', reason, closedAt: new Date() },
      });
      await tx.listingReport.updateMany({
        where: { listingId, societyId: ctx.societyId, status: 'OPEN' },
        data: { status: 'ACTIONED' },
      });
      const l = await tx.listing.update({
        where: { id: listingId, societyId: ctx.societyId },
        data: { status: 'HIDDEN', hiddenReason: reason },
        include: listingInclude,
      });
      await this.audit.record(
        {
          action: 'listing.hidden',
          entityType: 'Listing',
          entityId: listingId,
          before: { status: before.status, title: before.title },
          after: { status: 'HIDDEN', reason, cancelledOrders: open.length },
        },
        tx,
      );
      return { row: l, cancelled: open };
    });
    const sellerUser = (await this.userIds([before.sellerMembershipId]))[0];
    if (sellerUser)
      await this.notifications.notifyUsers({
        userIds: [sellerUser],
        societyId: ctx.societyId,
        category: 'MARKETPLACE',
        render: (t) => ({
          title: t('market:push.hiddenTitle', { title: before.title }),
          body: reason,
        }),
        data: { screen: 'listing', societyId: ctx.societyId, listingId },
      });
    const buyers = await this.userIds(cancelled.map((o) => o.buyerMembershipId));
    if (buyers.length)
      await this.notifications.notifyUsers({
        userIds: buyers,
        societyId: ctx.societyId,
        category: 'MARKETPLACE',
        render: (t) => ({
          title: t('market:push.cancelledTitle', { title: before.title }),
          body: '',
        }),
        data: { screen: 'listing', societyId: ctx.societyId, listingId },
      });
    return this.detail(ctx, row);
  }

  async unhide(listingId: string): Promise<Listing> {
    const ctx = requireTenant();
    const before = await this.requireListing(listingId);
    if (before.status !== 'HIDDEN') return this.detail(ctx, before);
    const row = await this.prisma.$transaction(async (tx) => {
      const l = await tx.listing.update({
        where: { id: listingId, societyId: ctx.societyId },
        data: { status: 'PAUSED', hiddenReason: null },
        include: listingInclude,
      });
      await this.audit.record(
        {
          action: 'listing.unhidden',
          entityType: 'Listing',
          entityId: listingId,
          before: { status: 'HIDDEN', reason: before.hiddenReason },
          after: { status: 'PAUSED' },
        },
        tx,
      );
      return l;
    });
    return this.detail(ctx, row);
  }

  async dismiss(reportId: string): Promise<void> {
    const res = await this.db.listingReport.updateMany({
      where: { id: reportId, status: 'OPEN' },
      data: { status: 'DISMISSED' },
    });
    if (res.count === 0) {
      const exists = await this.db.listingReport.count({ where: { id: reportId } });
      if (!exists) throw ApiException.notFound('Report not found');
    }
  }

  // ------------------------------------------------------------------ orders

  async order(listingId: string, body: RouteBody<C['createOrder']>): Promise<Order> {
    const ctx = requireTenant();
    const l = await this.requireListing(listingId);
    if (l.status !== 'ACTIVE') throw ApiException.notFound('Listing not found');
    if (l.sellerMembershipId === ctx.membershipId)
      throw ApiException.badRequest('VALIDATION_FAILED', 'You cannot order your own listing');
    if (l.orderBy && l.orderBy.getTime() < Date.now())
      throw ApiException.conflict('ORDERS_CLOSED', 'Orders for this are closed');
    if (l.fulfilment !== 'BOTH' && l.fulfilment !== body.fulfilment)
      throw ApiException.badRequest('VALIDATION_FAILED', 'The seller does not offer that');
    if (l.quantityAvailable !== null && l.quantityAvailable < body.quantity)
      throw ApiException.conflict('OUT_OF_STOCK', 'Not enough left');
    const open = await this.db.marketOrder.count({
      where: { listingId, buyerMembershipId: ctx.membershipId, status: { in: OPEN } },
    });
    if (open) throw ApiException.conflict('CONFLICT', 'You already have an open order for this');
    const o = await this.db.marketOrder.create({
      data: {
        societyId: ctx.societyId,
        listingId,
        buyerMembershipId: ctx.membershipId,
        sellerMembershipId: l.sellerMembershipId,
        quantity: body.quantity,
        unitPricePaise: l.priceType === 'FREE' ? null : l.pricePaise,
        fulfilment: body.fulfilment,
        note: body.note ?? null,
      },
      include: orderInclude,
    });
    const buyer = await loadMemberNames(this.prisma, [ctx.membershipId]);
    await this.notifyParty(ctx, o, 'seller', (t) => ({
      title: t('market:push.newOrderTitle', { title: l.title }),
      body: t('market:push.newOrderBody', {
        name: buyer.get(ctx.membershipId)?.displayName ?? '',
        quantity: l.unit ? `${body.quantity} ${l.unit}` : String(body.quantity),
      }),
    }));
    return this.orderDto(ctx, o);
  }

  async orders(role: 'BUYING' | 'SELLING'): Promise<OrderSummary[]> {
    const ctx = requireTenant();
    const rows = await this.db.marketOrder.findMany({
      where:
        role === 'BUYING'
          ? { buyerMembershipId: ctx.membershipId }
          : { sellerMembershipId: ctx.membershipId },
      include: orderInclude,
      orderBy: [{ updatedAt: 'desc' }],
      take: 100,
    });
    rows.sort((a, b) => Number(OPEN.includes(b.status)) - Number(OPEN.includes(a.status)));
    const names = await loadMemberNames(
      this.prisma,
      rows.flatMap((o) => [o.buyerMembershipId, o.sellerMembershipId]),
    );
    return rows.map((o) => this.orderSummary(ctx, o, names));
  }

  async getOrder(orderId: string): Promise<Order> {
    const ctx = requireTenant();
    const o = await this.requireOrder(ctx, orderId);
    const side = o.buyerMembershipId === ctx.membershipId ? 'buyerReadAt' : 'sellerReadAt';
    await this.db.marketOrder.updateMany({ where: { id: orderId }, data: { [side]: new Date() } });
    return this.orderDto(ctx, { ...o, [side]: new Date() });
  }

  async accept(orderId: string): Promise<Order> {
    const ctx = requireTenant();
    const o = await this.requireOrder(ctx, orderId);
    if (o.sellerMembershipId !== ctx.membershipId) throw ApiException.forbidden();
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.marketOrder.updateMany({
        where: { id: orderId, societyId: ctx.societyId, status: 'REQUESTED' },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });
      if (moved.count === 0) throw ApiException.conflict('CONFLICT', 'This order has moved on');
      // Race-safe: only takes stock when enough is left.
      const took = await tx.listing.updateMany({
        where: {
          id: o.listingId,
          societyId: ctx.societyId,
          OR: [{ quantityAvailable: null }, { quantityAvailable: { gte: o.quantity } }],
        },
        data:
          o.listing.quantityAvailable === null
            ? {}
            : { quantityAvailable: { decrement: o.quantity } },
      });
      if (took.count === 0) throw ApiException.conflict('OUT_OF_STOCK', 'Not enough left');
    });
    return this.afterChange(ctx, orderId, 'buyer', (t) => ({
      title: t('market:push.acceptedTitle', { title: o.listing.title }),
      body: '',
    }));
  }

  async reject(orderId: string, reason: string | undefined): Promise<Order> {
    const ctx = requireTenant();
    const o = await this.requireOrder(ctx, orderId);
    if (o.sellerMembershipId !== ctx.membershipId) throw ApiException.forbidden();
    await this.move(orderId, ['REQUESTED'], {
      status: 'REJECTED',
      reason: reason || null,
      closedAt: new Date(),
    });
    return this.afterChange(ctx, orderId, 'buyer', (t) => ({
      title: t('market:push.rejectedTitle', { title: o.listing.title }),
      body: reason ?? '',
    }));
  }

  async ready(orderId: string): Promise<Order> {
    const ctx = requireTenant();
    const o = await this.requireOrder(ctx, orderId);
    if (o.sellerMembershipId !== ctx.membershipId) throw ApiException.forbidden();
    await this.move(orderId, ['ACCEPTED'], { status: 'READY', readyAt: new Date() });
    return this.afterChange(ctx, orderId, 'buyer', (t) => ({
      title: t('market:push.readyTitle', { title: o.listing.title }),
      body:
        o.fulfilment === 'DELIVERY' ? t('market:push.readyDelivery') : t('market:push.readyPickup'),
    }));
  }

  async complete(orderId: string): Promise<Order> {
    const ctx = requireTenant();
    const o = await this.requireOrder(ctx, orderId);
    await this.move(orderId, ['ACCEPTED', 'READY'], {
      status: 'COMPLETED',
      closedAt: new Date(),
    });
    const other = o.buyerMembershipId === ctx.membershipId ? 'seller' : 'buyer';
    return this.afterChange(ctx, orderId, other, (t) => ({
      title: t('market:push.completedTitle', { title: o.listing.title }),
      body: '',
    }));
  }

  async cancel(orderId: string, reason: string | undefined): Promise<Order> {
    const ctx = requireTenant();
    const o = await this.requireOrder(ctx, orderId);
    const buyer = o.buyerMembershipId === ctx.membershipId;
    const allowed: OrderStatus[] = buyer ? ['REQUESTED', 'ACCEPTED'] : ['ACCEPTED', 'READY'];
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.marketOrder.updateMany({
        where: { id: orderId, societyId: ctx.societyId, status: { in: allowed } },
        data: { status: 'CANCELLED', reason: reason || null, closedAt: new Date() },
      });
      if (moved.count === 0)
        throw ApiException.conflict('CONFLICT', 'This order cannot be cancelled now');
      // Stock taken at accept goes back.
      if (o.status !== 'REQUESTED' && o.listing.quantityAvailable !== null)
        await tx.listing.updateMany({
          where: { id: o.listingId, societyId: ctx.societyId, quantityAvailable: { not: null } },
          data: { quantityAvailable: { increment: o.quantity } },
        });
    });
    return this.afterChange(ctx, orderId, buyer ? 'seller' : 'buyer', (t) => ({
      title: t('market:push.cancelledTitle', { title: o.listing.title }),
      body: reason ?? '',
    }));
  }

  async message(orderId: string, body: string): Promise<Order> {
    const ctx = requireTenant();
    const o = await this.requireOrder(ctx, orderId);
    if (!canMessage(o.status)) throw ApiException.conflict('CONFLICT', 'This order is closed');
    const buyer = o.buyerMembershipId === ctx.membershipId;
    await this.prisma.$transaction(async (tx) => {
      await tx.orderMessage.create({
        data: {
          societyId: ctx.societyId,
          orderId,
          senderMembershipId: ctx.membershipId,
          body,
        },
      });
      await tx.marketOrder.update({
        where: { id: orderId, societyId: ctx.societyId },
        data: buyer ? { buyerReadAt: new Date() } : { sellerReadAt: new Date() },
      });
    });
    const me = await loadMemberNames(this.prisma, [ctx.membershipId]);
    return this.afterChange(ctx, orderId, buyer ? 'seller' : 'buyer', (t) => ({
      title: t('market:push.messageTitle', {
        name: me.get(ctx.membershipId)?.displayName ?? '',
        title: o.listing.title,
      }),
      body,
    }));
  }

  async review(orderId: string, rating: number, text: string | null | undefined): Promise<Order> {
    const ctx = requireTenant();
    const o = await this.requireOrder(ctx, orderId);
    if (o.buyerMembershipId !== ctx.membershipId) throw ApiException.forbidden();
    if (o.status !== 'COMPLETED')
      throw ApiException.conflict('CONFLICT', 'You can review once the order is completed');
    if (o.review) throw ApiException.conflict('CONFLICT', 'You already reviewed this order');
    await this.prisma.$transaction(async (tx) => {
      await tx.listingReview.create({
        data: {
          societyId: ctx.societyId,
          listingId: o.listingId,
          orderId,
          authorMembershipId: ctx.membershipId,
          rating,
          text: text || null,
        },
      });
      await tx.listing.update({
        where: { id: o.listingId, societyId: ctx.societyId },
        data: { ratingSum: { increment: rating }, ratingCount: { increment: 1 } },
      });
    });
    return this.afterChange(ctx, orderId, 'seller', (t) => ({
      title: t('market:push.reviewTitle', { title: o.listing.title }),
      body: t('market:push.reviewBody', { rating }),
    }));
  }

  /** Home: new orders waiting for me as a seller. */
  waitingCount(membershipId: string): Promise<number> {
    return this.db.marketOrder.count({
      where: { sellerMembershipId: membershipId, status: 'REQUESTED' },
    });
  }

  // ----------------------------------------------------------------- helpers

  private validate(ctx: TenantContext, b: ListingBody) {
    const s = this.settings(ctx);
    const bad = (message: string) => ApiException.badRequest('VALIDATION_FAILED', message);
    if (b.kind === 'FOOD' && !s.foodEnabled) throw bad('Food is switched off in this society');
    if (b.kind === 'RESALE' && !s.resaleEnabled)
      throw bad('Resale is switched off in this society');
    if (b.visibility === 'NETWORK' && !s.network)
      throw bad('This society shares listings only inside the society');
    const priced = b.priceType === 'FIXED' || b.priceType === 'PER_UNIT';
    if (priced && !b.pricePaise) throw bad('Enter a price');
    if (b.priceType === 'PER_UNIT' && !b.unit) throw bad('Enter a unit, for example plate or kg');
    const food = b.kind === 'FOOD';
    if (food && !b.diet) throw bad('Mark the food as veg, egg or non-veg');
    const readyAt = food && b.readyAt ? new Date(b.readyAt) : null;
    const orderBy = food && b.orderBy ? new Date(b.orderBy) : null;
    if (readyAt && orderBy && orderBy > readyAt)
      throw bad('Order-by time must be before the ready time');
    return {
      kind: b.kind,
      title: b.title,
      description: b.description ?? null,
      priceType: b.priceType,
      pricePaise: b.priceType === 'FREE' ? null : (b.pricePaise ?? null),
      unit: b.priceType === 'PER_UNIT' ? (b.unit ?? null) : null,
      diet: food ? (b.diet ?? null) : null,
      quantityAvailable: b.quantityAvailable ?? null,
      readyAt,
      orderBy,
      fulfilment: b.fulfilment,
      condition: b.kind === 'RESALE' ? (b.condition ?? null) : null,
      visibility: b.visibility,
      showPhoneAfterAccept: b.showPhoneAfterAccept,
    } satisfies Partial<Prisma.ListingUncheckedCreateInput>;
  }

  private async requireOwnImages(ctx: TenantContext, ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    const found = await this.db.storedFile.count({
      where: { id: { in: unique }, ownerMembershipId: ctx.membershipId },
    });
    if (found !== unique.length) throw ApiException.notFound('Photo not found');
    return unique;
  }

  private async requireListing(listingId: string): Promise<ListingRow> {
    const row = await this.db.listing.findUnique({
      where: { id: listingId },
      include: listingInclude,
    });
    if (!row) throw ApiException.notFound('Listing not found');
    return row;
  }

  private async requireOwnListing(ctx: TenantContext, listingId: string): Promise<ListingRow> {
    const row = await this.requireListing(listingId);
    if (row.sellerMembershipId !== ctx.membershipId)
      throw ApiException.notFound('Listing not found');
    return row;
  }

  private async requireOrder(ctx: TenantContext, orderId: string): Promise<OrderRow> {
    const o = await this.db.marketOrder.findUnique({
      where: { id: orderId },
      include: orderInclude,
    });
    if (
      !o ||
      (o.buyerMembershipId !== ctx.membershipId && o.sellerMembershipId !== ctx.membershipId)
    )
      throw ApiException.notFound('Order not found');
    return o;
  }

  private async move(
    orderId: string,
    from: OrderStatus[],
    data: Prisma.MarketOrderUpdateManyMutationInput,
  ): Promise<void> {
    const moved = await this.db.marketOrder.updateMany({
      where: { id: orderId, status: { in: from } },
      data,
    });
    if (moved.count === 0) throw ApiException.conflict('CONFLICT', 'This order has moved on');
  }

  private async afterChange(
    ctx: TenantContext,
    orderId: string,
    notify: 'buyer' | 'seller',
    render: (t: (key: string, opts?: Record<string, unknown>) => string) => {
      title: string;
      body: string;
    },
  ): Promise<Order> {
    const o = await this.requireOrder(ctx, orderId);
    await this.notifyParty(ctx, o, notify, render);
    return this.orderDto(ctx, o);
  }

  private async notifyParty(
    ctx: TenantContext,
    o: OrderRow,
    who: 'buyer' | 'seller',
    render: (t: (key: string, opts?: Record<string, unknown>) => string) => {
      title: string;
      body: string;
    },
  ): Promise<void> {
    const userIds = await this.userIds([
      who === 'buyer' ? o.buyerMembershipId : o.sellerMembershipId,
    ]);
    await this.notifications.notifyUsers({
      userIds,
      societyId: ctx.societyId,
      category: 'MARKETPLACE',
      render: (t) => render(t as (key: string, opts?: Record<string, unknown>) => string),
      data: { screen: 'order', societyId: ctx.societyId, orderId: o.id },
    });
  }

  private async userIds(membershipIds: string[]): Promise<string[]> {
    const rows = await this.prisma.membership.findMany({
      where: { id: { in: membershipIds } },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  /** "A-101" for each membership's first current flat. */
  private async flatLabels(membershipIds: string[]): Promise<Map<string, string>> {
    const rows = await this.db.flatOccupancy.findMany({
      where: { membershipId: { in: membershipIds }, toDate: null },
      include: { flat: { include: { building: true } } },
      orderBy: [{ isPrimaryContact: 'desc' }, { fromDate: 'asc' }],
    });
    const out = new Map<string, string>();
    for (const r of rows)
      if (!out.has(r.membershipId))
        out.set(
          r.membershipId,
          r.flat.building ? `${r.flat.building.name}-${r.flat.number}` : r.flat.number,
        );
    return out;
  }

  private async summaries(ctx: TenantContext, rows: ListingRow[]): Promise<ListingSummary[]> {
    const names = await loadMemberNames(
      this.prisma,
      rows.map((r) => r.sellerMembershipId),
    );
    const now = Date.now();
    return rows.map((r) => this.summary(ctx, r, names.get(r.sellerMembershipId)?.displayName, now));
  }

  private summary(
    ctx: TenantContext,
    r: ListingRow,
    sellerName: string | undefined,
    now = Date.now(),
  ): ListingSummary {
    const cover = r.images[0];
    return {
      id: r.id,
      kind: r.kind,
      title: r.title,
      priceType: r.priceType,
      pricePaise: r.pricePaise,
      unit: r.unit,
      diet: r.diet,
      cover: cover ? this.files.ref(cover.fileId, now) : null,
      seller: { membershipId: r.sellerMembershipId, displayName: sellerName ?? '' },
      rating: r.ratingCount
        ? { average: Math.round((r.ratingSum / r.ratingCount) * 10) / 10, count: r.ratingCount }
        : null,
      quantityAvailable: r.quantityAvailable,
      soldOut: r.quantityAvailable === 0,
      readyAt: r.readyAt?.toISOString() ?? null,
      orderBy: r.orderBy?.toISOString() ?? null,
      ordersClosed: Boolean(r.orderBy && r.orderBy.getTime() < now),
      status: r.status,
      isMine: r.sellerMembershipId === ctx.membershipId,
      createdAt: r.createdAt.toISOString(),
    };
  }

  private async detail(ctx: TenantContext, r: ListingRow): Promise<Listing> {
    const [names, reviews, myOpen] = await Promise.all([
      loadMemberNames(this.prisma, [r.sellerMembershipId]),
      this.db.listingReview.findMany({
        where: { listingId: r.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.db.marketOrder.findFirst({
        where: { listingId: r.id, buyerMembershipId: ctx.membershipId, status: { in: OPEN } },
        select: { id: true },
      }),
    ]);
    const authors = await loadMemberNames(
      this.prisma,
      reviews.map((v) => v.authorMembershipId),
    );
    const now = Date.now();
    const s = this.summary(ctx, r, names.get(r.sellerMembershipId)?.displayName, now);
    const mine = s.isMine;
    const moderator = can(ctx, 'marketplace.moderate');
    return {
      ...s,
      description: r.description,
      images: r.images.map((i) => this.files.ref(i.fileId, now)),
      fulfilment: r.fulfilment,
      condition: r.condition,
      visibility: r.visibility,
      showPhoneAfterAccept: r.showPhoneAfterAccept,
      reviews: reviews.map((v) => ({
        id: v.id,
        rating: v.rating,
        text: v.text,
        by: authors.get(v.authorMembershipId)?.displayName ?? '',
        createdAt: v.createdAt.toISOString(),
      })),
      myOpenOrderId: myOpen?.id ?? null,
      hiddenReason: mine || moderator ? r.hiddenReason : null,
      canOrder: r.status === 'ACTIVE' && !mine && !s.soldOut && !s.ordersClosed && !myOpen,
      canEdit: mine && r.status !== 'HIDDEN',
      canModerate: moderator && !mine,
    };
  }

  private orderSummary(
    ctx: TenantContext,
    o: OrderRow,
    names: Map<string, { displayName: string }>,
  ): OrderSummary {
    const buyer = o.buyerMembershipId === ctx.membershipId;
    const other = buyer ? o.sellerMembershipId : o.buyerMembershipId;
    const readAt = buyer ? o.buyerReadAt : o.sellerReadAt;
    const cover = o.listing.images[0];
    return {
      id: o.id,
      listing: {
        id: o.listing.id,
        kind: o.listing.kind,
        title: o.listing.title,
        cover: cover ? this.files.ref(cover.fileId) : null,
        unit: o.listing.unit,
      },
      role: buyer ? 'BUYING' : 'SELLING',
      counterpart: { membershipId: other, displayName: names.get(other)?.displayName ?? '' },
      quantity: o.quantity,
      totalPaise: o.unitPricePaise === null ? null : o.unitPricePaise * o.quantity,
      fulfilment: o.fulfilment === 'DELIVERY' ? 'DELIVERY' : 'PICKUP',
      status: o.status,
      unreadMessages: o.messages.filter(
        (msg) => msg.senderMembershipId !== ctx.membershipId && msg.createdAt > readAt,
      ).length,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    };
  }

  private async orderDto(ctx: TenantContext, o: OrderRow): Promise<Order> {
    const ids = [o.buyerMembershipId, o.sellerMembershipId];
    const [names, flats] = await Promise.all([
      loadMemberNames(this.prisma, [...ids, ...o.messages.map((m) => m.senderMembershipId)]),
      this.flatLabels(ids),
    ]);
    const s = this.orderSummary(ctx, o, names);
    const buyer = s.role === 'BUYING';
    const agreed = o.status === 'ACCEPTED' || o.status === 'READY' || o.status === 'COMPLETED';
    const party = (membershipId: string, isSeller: boolean) => ({
      membershipId,
      displayName: names.get(membershipId)?.displayName ?? '',
      flat: agreed ? (flats.get(membershipId) ?? null) : null,
      phone:
        agreed && isSeller && o.listing.showPhoneAfterAccept
          ? (names.get(membershipId)?.phone ?? null)
          : null,
    });
    const open = OPEN.includes(o.status);
    return {
      ...s,
      unreadMessages: 0,
      buyer: party(o.buyerMembershipId, false),
      seller: party(o.sellerMembershipId, true),
      note: o.note,
      reason: o.reason,
      readyAt: o.readyAt?.toISOString() ?? null,
      messages: o.messages.map((m) => ({
        id: m.id,
        body: m.body,
        mine: m.senderMembershipId === ctx.membershipId,
        by: names.get(m.senderMembershipId)?.displayName ?? '',
        createdAt: m.createdAt.toISOString(),
      })),
      review: o.review
        ? {
            id: o.review.id,
            rating: o.review.rating,
            text: o.review.text,
            by: names.get(o.review.authorMembershipId)?.displayName ?? '',
            createdAt: o.review.createdAt.toISOString(),
          }
        : null,
      canAccept: !buyer && o.status === 'REQUESTED',
      canReject: !buyer && o.status === 'REQUESTED',
      canMarkReady: !buyer && o.status === 'ACCEPTED',
      canComplete: o.status === 'ACCEPTED' || o.status === 'READY',
      canCancel: buyer
        ? o.status === 'REQUESTED' || o.status === 'ACCEPTED'
        : o.status === 'ACCEPTED' || o.status === 'READY',
      canMessage: open || o.status === 'COMPLETED',
      canReview: buyer && o.status === 'COMPLETED' && !o.review,
    };
  }
}

function canMessage(status: OrderStatus): boolean {
  return status !== 'REJECTED' && status !== 'CANCELLED';
}
