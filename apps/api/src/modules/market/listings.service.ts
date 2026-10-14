import type {
  Listing,
  ListingSummary,
  marketContract,
  RouteBody,
  RouteQuery,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import { afterCursor, decodeCursor, slicePage } from '../../common/util/pagination';
import type { Prisma } from '../../generated/prisma/client';
import { FilesService } from '../files/files.service';
import {
  type ListingRow,
  listingInclude,
  MarketViews,
  marketSettings,
} from './market-views.service';
import { OPEN_ORDER } from './order-state';

type C = typeof marketContract;
type ListingBody = RouteBody<C['createListing']>;
type ListingPatch = RouteBody<C['updateListing']>;

/** Food that was ready more than 12 hours ago drops out of the market by itself. */
const FOOD_SHELF_MS = 12 * 60 * 60 * 1000;

/** A seller's listings: browse, create, edit, pause, report. */
@Injectable()
export class ListingsService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly files: FilesService,
    private readonly views: MarketViews,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async list(query: RouteQuery<C['listListings']>) {
    const ctx = requireTenant();
    const cursor = decodeCursor(query.cursor);
    const now = new Date();
    const s = marketSettings(ctx);
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
          afterCursor(cursor),
        ],
      },
      include: listingInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = slicePage(rows, query.limit);
    return { items: await this.views.summaries(ctx, page.items), nextCursor: page.nextCursor };
  }

  async mine(): Promise<ListingSummary[]> {
    const ctx = requireTenant();
    const rows = await this.db.listing.findMany({
      where: { sellerMembershipId: ctx.membershipId, status: { not: 'ARCHIVED' } },
      include: listingInclude,
      orderBy: [{ createdAt: 'desc' }],
    });
    return this.views.summaries(ctx, rows);
  }

  async get(listingId: string): Promise<Listing> {
    const ctx = requireTenant();
    const row = await this.views.requireListing(listingId);
    const mine = row.sellerMembershipId === ctx.membershipId;
    const moderator = can(ctx, 'marketplace.moderate');
    if ((row.status === 'HIDDEN' || row.status === 'ARCHIVED') && !mine && !moderator)
      throw ApiException.notFound('Listing not found');
    if (row.status === 'PAUSED' && !mine && !moderator) {
      // A buyer with an open order can still open the listing it came from.
      const open = await this.db.marketOrder.count({
        where: { listingId, buyerMembershipId: ctx.membershipId, status: { in: [...OPEN_ORDER] } },
      });
      if (!open) throw ApiException.notFound('Listing not found');
    }
    return this.views.detail(ctx, row);
  }

  async create(body: ListingBody): Promise<Listing> {
    const ctx = requireTenant();
    const data = this.validate(ctx, body);
    const imageIds = await this.requireOwnImages(ctx, body.imageIds);
    const row = await this.tenant.tx(async (tx) => {
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
    return this.views.detail(ctx, row);
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
    const row = await this.tenant.tx(async (tx) => {
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
    return this.views.detail(ctx, row);
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
    return this.views.detail(ctx, row);
  }

  async report(listingId: string, reason: string): Promise<void> {
    const ctx = requireTenant();
    const row = await this.views.requireListing(listingId);
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

  private validate(ctx: TenantContext, b: ListingBody) {
    const s = marketSettings(ctx);
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

  private async requireOwnListing(ctx: TenantContext, listingId: string): Promise<ListingRow> {
    const row = await this.views.requireListing(listingId);
    if (row.sellerMembershipId !== ctx.membershipId)
      throw ApiException.notFound('Listing not found');
    return row;
  }
}
