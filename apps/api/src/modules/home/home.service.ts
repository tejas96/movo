import type { AttentionItem, HomeSummary, UpcomingItem } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can } from '../../common/tenant/tenant.types';
import { EmergencyService } from '../emergency/emergency.service';
import { EventsService } from '../events/events.service';
import { AccountsService } from '../maintenance/accounts.service';
import { MeetingsService } from '../meetings/meetings.service';
import { NoticesService } from '../notices/notices.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VendorsService } from '../vendors/vendors.service';

/** Home shows one or two upcoming meetings or events. */
const UPCOMING_ON_HOME = 2;

/** The server decides what matters today. The app only renders. */
@Injectable()
export class HomeService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly notices: NoticesService,
    private readonly notifications: NotificationsService,
    private readonly emergency: EmergencyService,
    private readonly vendors: VendorsService,
    private readonly meetings: MeetingsService,
    private readonly events: EventsService,
    private readonly accounts: AccountsService,
  ) {}

  async summary(): Promise<HomeSummary> {
    const ctx = requireTenant();
    const attention: AttentionItem[] = [];

    // Money owed comes right after alerts and important notices, before admin items.
    if (ctx.enabledModules.has('maintenance'))
      attention.push(...(await this.accounts.attentionForHome(ctx)));

    if (can(ctx, 'member.manage')) {
      const [joinRequests, invitations] = await Promise.all([
        this.tenant.client.joinRequest.count({ where: { status: 'PENDING' } }),
        this.tenant.client.invitation.count({
          where: { status: 'PENDING', expiresAt: { gt: new Date() } },
        }),
      ]);
      if (joinRequests > 0) attention.push({ type: 'JOIN_REQUESTS_PENDING', count: joinRequests });
      if (invitations > 0) attention.push({ type: 'INVITATIONS_PENDING', count: invitations });
    }
    if (ctx.enabledModules.has('vendors') && can(ctx, 'vendor.manage')) {
      const suggestions = await this.vendors.countSuggestions();
      if (suggestions > 0) attention.push({ type: 'VENDOR_SUGGESTIONS', count: suggestions });
    }

    const noticesEnabled = ctx.enabledModules.has('notices');
    const { notices, unreadImportant } = noticesEnabled
      ? await this.notices.forHome(ctx, 3)
      : { notices: [], unreadImportant: [] };
    for (const n of unreadImportant.slice(0, 2)) {
      attention.unshift({
        type: 'IMPORTANT_NOTICE',
        noticeId: n.id,
        title: n.title,
        priority: n.priority === 'EMERGENCY' ? 'EMERGENCY' : 'IMPORTANT',
      });
    }

    // Active alerts go above everything else, including important notices.
    if (ctx.enabledModules.has('emergency'))
      attention.unshift(...(await this.emergency.attentionForHome()));

    const now = new Date();
    const upcoming: UpcomingItem[] = [
      ...(ctx.enabledModules.has('meetings') ? await this.meetings.forHome(ctx, now) : []),
      ...(ctx.enabledModules.has('events') ? await this.events.forHome(ctx, now) : []),
    ]
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, UPCOMING_ON_HOME);

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { email: true, phone: true },
    });
    if (!user.email) attention.push({ type: 'PROFILE_INCOMPLETE', missing: ['email'] });

    const membership = await this.tenant.client.membership.findUniqueOrThrow({
      where: { id: ctx.membershipId },
      include: {
        occupancies: {
          where: { toDate: null },
          include: { flat: { include: { building: true } } },
        },
      },
    });

    return {
      generatedAt: new Date().toISOString(),
      society: ctx.society,
      flats: membership.occupancies.map((o) => ({
        id: o.flat.id,
        number: o.flat.number,
        buildingId: o.flat.buildingId,
        buildingName: o.flat.building?.name ?? null,
        relation: o.relation,
        isPrimaryContact: o.isPrimaryContact,
      })),
      attention,
      upcoming,
      notices,
      unreadNotifications: await this.notifications.unreadCount(ctx.userId),
    };
  }
}
