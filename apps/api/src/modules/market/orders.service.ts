import type { marketContract, Order, OrderStatus, OrderSummary, RouteBody } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import type { TenantContext } from '../../common/tenant/tenant.types';
import type { Prisma } from '../../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { Recipients } from '../notifications/recipients.service';
import { loadMemberNames } from '../tenancy/member-names';
import { MarketViews, type OrderRow, orderInclude } from './market-views.service';
import {
  allowedFrom,
  canMessageOrder,
  isOpenOrder,
  OPEN_ORDER,
  type OrderSide,
} from './order-state';

type C = typeof marketContract;
type Render = (t: (key: string, opts?: Record<string, unknown>) => string) => {
  title: string;
  body: string;
};

/** Orders between neighbours, with their chat and the buyer's review. */
@Injectable()
export class OrdersService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly recipients: Recipients,
    private readonly views: MarketViews,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async order(listingId: string, body: RouteBody<C['createOrder']>): Promise<Order> {
    const ctx = requireTenant();
    const l = await this.views.requireListing(listingId);
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
      where: { listingId, buyerMembershipId: ctx.membershipId, status: { in: [...OPEN_ORDER] } },
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
    return this.views.orderDto(ctx, o);
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
    rows.sort((a, b) => Number(isOpenOrder(b.status)) - Number(isOpenOrder(a.status)));
    const names = await loadMemberNames(
      this.prisma,
      rows.flatMap((o) => [o.buyerMembershipId, o.sellerMembershipId]),
    );
    return rows.map((o) => this.views.orderSummary(ctx, o, names));
  }

  async getOrder(orderId: string): Promise<Order> {
    const ctx = requireTenant();
    const o = await this.views.requireOrder(ctx, orderId);
    const side = o.buyerMembershipId === ctx.membershipId ? 'buyerReadAt' : 'sellerReadAt';
    await this.db.marketOrder.updateMany({ where: { id: orderId }, data: { [side]: new Date() } });
    return this.views.orderDto(ctx, { ...o, [side]: new Date() });
  }

  async accept(orderId: string): Promise<Order> {
    const ctx = requireTenant();
    const o = await this.views.requireOrder(ctx, orderId);
    if (o.sellerMembershipId !== ctx.membershipId) throw ApiException.forbidden();
    await this.tenant.tx(async (tx) => {
      const moved = await tx.marketOrder.updateMany({
        where: {
          id: orderId,
          societyId: ctx.societyId,
          status: { in: allowedFrom('accept', 'seller') },
        },
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
    const o = await this.views.requireOrder(ctx, orderId);
    if (o.sellerMembershipId !== ctx.membershipId) throw ApiException.forbidden();
    await this.move(orderId, allowedFrom('reject', 'seller'), {
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
    const o = await this.views.requireOrder(ctx, orderId);
    if (o.sellerMembershipId !== ctx.membershipId) throw ApiException.forbidden();
    await this.move(orderId, allowedFrom('ready', 'seller'), {
      status: 'READY',
      readyAt: new Date(),
    });
    return this.afterChange(ctx, orderId, 'buyer', (t) => ({
      title: t('market:push.readyTitle', { title: o.listing.title }),
      body:
        o.fulfilment === 'DELIVERY' ? t('market:push.readyDelivery') : t('market:push.readyPickup'),
    }));
  }

  async complete(orderId: string): Promise<Order> {
    const ctx = requireTenant();
    const o = await this.views.requireOrder(ctx, orderId);
    const side = sideOf(ctx, o);
    await this.move(orderId, allowedFrom('complete', side), {
      status: 'COMPLETED',
      closedAt: new Date(),
    });
    return this.afterChange(ctx, orderId, otherSide(side), (t) => ({
      title: t('market:push.completedTitle', { title: o.listing.title }),
      body: '',
    }));
  }

  async cancel(orderId: string, reason: string | undefined): Promise<Order> {
    const ctx = requireTenant();
    const o = await this.views.requireOrder(ctx, orderId);
    const side = sideOf(ctx, o);
    await this.tenant.tx(async (tx) => {
      const moved = await tx.marketOrder.updateMany({
        where: {
          id: orderId,
          societyId: ctx.societyId,
          status: { in: allowedFrom('cancel', side) },
        },
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
    return this.afterChange(ctx, orderId, otherSide(side), (t) => ({
      title: t('market:push.cancelledTitle', { title: o.listing.title }),
      body: reason ?? '',
    }));
  }

  async message(orderId: string, body: string): Promise<Order> {
    const ctx = requireTenant();
    const o = await this.views.requireOrder(ctx, orderId);
    if (!canMessageOrder(o.status)) throw ApiException.conflict('CONFLICT', 'This order is closed');
    const buyer = o.buyerMembershipId === ctx.membershipId;
    await this.tenant.tx(async (tx) => {
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
    const o = await this.views.requireOrder(ctx, orderId);
    if (o.buyerMembershipId !== ctx.membershipId) throw ApiException.forbidden();
    if (o.status !== 'COMPLETED')
      throw ApiException.conflict('CONFLICT', 'You can review once the order is completed');
    if (o.review) throw ApiException.conflict('CONFLICT', 'You already reviewed this order');
    await this.tenant.tx(async (tx) => {
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
    notify: OrderSide,
    render: Render,
  ): Promise<Order> {
    const o = await this.views.requireOrder(ctx, orderId);
    await this.notifyParty(ctx, o, notify, render);
    return this.views.orderDto(ctx, o);
  }

  private async notifyParty(
    ctx: TenantContext,
    o: OrderRow,
    who: OrderSide,
    render: Render,
  ): Promise<void> {
    await this.notifications.notifyUsers({
      userIds: await this.recipients.ofMemberships([
        who === 'buyer' ? o.buyerMembershipId : o.sellerMembershipId,
      ]),
      societyId: ctx.societyId,
      category: 'MARKETPLACE',
      render: (t) => render(t as (key: string, opts?: Record<string, unknown>) => string),
      data: { screen: 'order', societyId: ctx.societyId, orderId: o.id },
    });
  }
}

function sideOf(ctx: TenantContext, o: OrderRow): OrderSide {
  return o.buyerMembershipId === ctx.membershipId ? 'buyer' : 'seller';
}

function otherSide(side: OrderSide): OrderSide {
  return side === 'buyer' ? 'seller' : 'buyer';
}
