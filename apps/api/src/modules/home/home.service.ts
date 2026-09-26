import type { AttentionItem, HomeSummary, UpcomingItem } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can } from '../../common/tenant/tenant.types';
import { DutiesService } from '../duties/duties.service';
import { EmergencyService } from '../emergency/emergency.service';
import { EventsService } from '../events/events.service';
import { ExpensesService } from '../expenses/expenses.service';
import { AccountsService } from '../maintenance/accounts.service';
import { MarketService } from '../market/market.service';
import { MeetingsService } from '../meetings/meetings.service';
import { NoticesService } from '../notices/notices.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RewardsService } from '../rewards/rewards.service';
import { TasksService } from '../tasks/tasks.service';
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
    private readonly expenses: ExpensesService,
    private readonly duties: DutiesService,
    private readonly tasks: TasksService,
    private readonly market: MarketService,
    private readonly rewards: RewardsService,
  ) {}

  async summary(): Promise<HomeSummary> {
    const ctx = requireTenant();
    const attention: AttentionItem[] = [];

    // Order: money owed, my duty, my tasks, then admin items. Alerts and important notices go on top below.
    if (ctx.enabledModules.has('maintenance'))
      attention.push(...(await this.accounts.attentionForHome(ctx)));
    if (ctx.enabledModules.has('responsibilities'))
      attention.push(...(await this.duties.attentionForHome(ctx)));
    if (ctx.enabledModules.has('tasks'))
      attention.push(...(await this.tasks.attentionForHome(ctx)));
    if (ctx.enabledModules.has('marketplace')) {
      const waiting = await this.market.waitingCount(ctx.membershipId);
      if (waiting > 0) attention.push({ type: 'MARKET_ORDERS_WAITING', count: waiting });
    }

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
    if (ctx.enabledModules.has('expenses'))
      attention.push(...(await this.expenses.attentionForHome(ctx)));
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

    let contribution: HomeSummary['contribution'] = null;
    if (ctx.enabledModules.has('rewards')) {
      const [points, openTasks] = await Promise.all([
        this.rewards.pointsThisYear(ctx),
        ctx.enabledModules.has('tasks') ? this.tasks.openTaskCount(ctx) : Promise.resolve(0),
      ]);
      if (points !== 0 || openTasks > 0) contribution = { points, openTasks };
    }

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
      contribution,
    };
  }
}
