import {
  type Listing,
  type ListingSummary,
  type Order,
  type OrderSummary,
  parseModuleSettings,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import type { Prisma } from '../../generated/prisma/client';
import { FilesService } from '../files/files.service';
import { flatLabel } from '../tenancy/mappers';
import { loadMemberNames } from '../tenancy/member-names';
import { isAgreed, OPEN_ORDER, orderActions } from './order-state';

export const listingInclude = {
  images: { orderBy: { sortOrder: 'asc' } },
} as const satisfies Prisma.ListingInclude;
export type ListingRow = Prisma.ListingGetPayload<{ include: typeof listingInclude }>;

export const orderInclude = {
  listing: { include: listingInclude },
  messages: { orderBy: { createdAt: 'asc' } },
  review: true,
} as const satisfies Prisma.MarketOrderInclude;
export type OrderRow = Prisma.MarketOrderGetPayload<{ include: typeof orderInclude }>;

/** What an order list row needs: no messages, the unread count comes from SQL. */
export const orderListInclude = {
  listing: { include: listingInclude },
} as const satisfies Prisma.MarketOrderInclude;
export type OrderListRow = Prisma.MarketOrderGetPayload<{ include: typeof orderListInclude }>;

export function marketSettings(ctx: TenantContext) {
  return parseModuleSettings('marketplace', ctx.moduleSettings.marketplace);
}

/** Loading and shaping of listings and orders, shared by the market services. */
@Injectable()
export class MarketViews {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async requireListing(listingId: string): Promise<ListingRow> {
    const row = await this.db.listing.findUnique({
      where: { id: listingId },
      include: listingInclude,
    });
    if (!row) throw ApiException.notFound('Listing not found');
    return row;
  }

  async requireOrder(ctx: TenantContext, orderId: string): Promise<OrderRow> {
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

  /** "A-101" for each membership's first current flat. */
  private async flatLabels(membershipIds: string[]): Promise<Map<string, string>> {
    const rows = await this.db.flatOccupancy.findMany({
      where: { membershipId: { in: membershipIds }, toDate: null },
      include: { flat: { include: { building: true } } },
      orderBy: [{ isPrimaryContact: 'desc' }, { fromDate: 'asc' }],
    });
    const out = new Map<string, string>();
    for (const r of rows) if (!out.has(r.membershipId)) out.set(r.membershipId, flatLabel(r.flat));
    return out;
  }

  async summaries(ctx: TenantContext, rows: ListingRow[]): Promise<ListingSummary[]> {
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

  async detail(ctx: TenantContext, r: ListingRow): Promise<Listing> {
    const [names, reviews, myOpen] = await Promise.all([
      loadMemberNames(this.prisma, [r.sellerMembershipId]),
      this.db.listingReview.findMany({
        where: { listingId: r.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.db.marketOrder.findFirst({
        where: {
          listingId: r.id,
          buyerMembershipId: ctx.membershipId,
          status: { in: [...OPEN_ORDER] },
        },
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

  /**
   * Messages from the other side newer than my last read, per order, counted by Postgres
   * (the list used to load every message of 100 orders to count them).
   */
  async unreadCounts(ctx: TenantContext, orderIds: string[]): Promise<Map<string, number>> {
    if (orderIds.length === 0) return new Map();
    const me = ctx.membershipId;
    const rows = await this.tenant.client.$queryRaw<{ orderId: string; n: number }[]>`
      SELECT m."orderId"::text AS "orderId", COUNT(*)::int AS n
      FROM "OrderMessage" m
      JOIN "MarketOrder" o ON o."id" = m."orderId"
      WHERE m."societyId" = ${ctx.societyId}::uuid
        AND m."orderId" = ANY(${orderIds}::uuid[])
        AND m."senderMembershipId" <> ${me}::uuid
        AND m."createdAt" > COALESCE(
          CASE WHEN o."buyerMembershipId" = ${me}::uuid THEN o."buyerReadAt" ELSE o."sellerReadAt" END,
          '-infinity'::timestamp)
      GROUP BY 1`;
    return new Map(rows.map((r) => [r.orderId, r.n]));
  }

  orderSummary(
    ctx: TenantContext,
    o: OrderListRow,
    names: Map<string, { displayName: string }>,
    unreadMessages: number,
  ): OrderSummary {
    const buyer = o.buyerMembershipId === ctx.membershipId;
    const other = buyer ? o.sellerMembershipId : o.buyerMembershipId;
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
      unreadMessages,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
    };
  }

  async orderDto(ctx: TenantContext, o: OrderRow): Promise<Order> {
    const ids = [o.buyerMembershipId, o.sellerMembershipId];
    const [names, flats] = await Promise.all([
      loadMemberNames(this.prisma, [...ids, ...o.messages.map((m) => m.senderMembershipId)]),
      this.flatLabels(ids),
    ]);
    const s = this.orderSummary(ctx, o, names, 0);
    const agreed = isAgreed(o.status);
    const party = (membershipId: string, isSeller: boolean) => ({
      membershipId,
      displayName: names.get(membershipId)?.displayName ?? '',
      flat: agreed ? (flats.get(membershipId) ?? null) : null,
      phone:
        agreed && isSeller && o.listing.showPhoneAfterAccept
          ? (names.get(membershipId)?.phone ?? null)
          : null,
    });
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
      ...orderActions(s.role === 'BUYING' ? 'buyer' : 'seller', o.status, Boolean(o.review)),
    };
  }
}
