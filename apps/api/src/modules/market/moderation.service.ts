import type { Listing, ListingReport, ListingSummary } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { NotificationsService } from '../notifications/notifications.service';
import { Recipients } from '../notifications/recipients.service';
import { loadMemberNames } from '../tenancy/member-names';
import { listingInclude, MarketViews } from './market-views.service';
import { OPEN_ORDER } from './order-state';

/** Moderators: open reports, take a listing down, put it back, dismiss a report. */
@Injectable()
export class ModerationService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly recipients: Recipients,
    private readonly views: MarketViews,
  ) {}

  private get db() {
    return this.tenant.client;
  }

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
    const summaries = await this.views.summaries(
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
    const before = await this.views.requireListing(listingId);
    const { row } = await this.tenant.tx(async (tx) => {
      const open = await tx.marketOrder.findMany({
        where: { listingId, societyId: ctx.societyId, status: { in: [...OPEN_ORDER] } },
      });
      await tx.marketOrder.updateMany({
        where: { listingId, societyId: ctx.societyId, status: { in: [...OPEN_ORDER] } },
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
      const recipients = this.recipients.in(tx);
      await this.notifications.notifyUsers(
        {
          userIds: await recipients.ofMemberships([before.sellerMembershipId]),
          societyId: ctx.societyId,
          category: 'MARKETPLACE',
          render: (t) => ({
            title: t('market:push.hiddenTitle', { title: before.title }),
            body: reason,
          }),
          data: { screen: 'listing', societyId: ctx.societyId, listingId },
        },
        tx,
      );
      await this.notifications.notifyUsers(
        {
          userIds: await recipients.ofMemberships(open.map((o) => o.buyerMembershipId)),
          societyId: ctx.societyId,
          category: 'MARKETPLACE',
          render: (t) => ({
            title: t('market:push.cancelledTitle', { title: before.title }),
            body: '',
          }),
          data: { screen: 'listing', societyId: ctx.societyId, listingId },
        },
        tx,
      );
      return { row: l, cancelled: open };
    });
    return this.views.detail(ctx, row);
  }

  async unhide(listingId: string): Promise<Listing> {
    const ctx = requireTenant();
    const before = await this.views.requireListing(listingId);
    if (before.status !== 'HIDDEN') return this.views.detail(ctx, before);
    const row = await this.tenant.tx(async (tx) => {
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
    return this.views.detail(ctx, row);
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
}
