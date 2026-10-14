import type { AttentionItem, HomeSummary } from '@movo/contracts';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { HOME_ORDER, type HomePart, HomeRegistry } from '../../common/home/home-registry';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import { NotificationsService } from '../notifications/notifications.service';

/** Home shows one or two upcoming meetings or events. */
const UPCOMING_ON_HOME = 2;

/**
 * The server decides what matters today. The app only renders. Each module registers its own
 * part in the HomeRegistry; Home loads the parts switched on for this society side by side and
 * puts them in HOME_ORDER.
 */
@Injectable()
export class HomeService implements OnModuleInit {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly registry: HomeRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register({
      module: null,
      order: HOME_ORDER.members,
      load: (ctx) => this.membersPart(ctx),
    });
    this.registry.register({
      module: null,
      order: HOME_ORDER.profile,
      load: (ctx) => this.profilePart(ctx),
    });
  }

  async summary(): Promise<HomeSummary> {
    const ctx = requireTenant();
    const now = new Date();
    const [parts, membership, unreadNotifications] = await Promise.all([
      Promise.all(this.registry.activeFor(ctx).map((s) => s.load(ctx, now))),
      this.tenant.client.membership.findUniqueOrThrow({
        where: { id: ctx.membershipId },
        include: {
          occupancies: {
            where: { toDate: null },
            include: { flat: { include: { building: true } } },
          },
        },
      }),
      this.notifications.unreadCount(ctx.userId),
    ]);

    // Sorting is stable: same start time keeps the registry order (meetings before events).
    const upcoming = parts
      .flatMap((p) => p.upcoming ?? [])
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, UPCOMING_ON_HOME);

    let contribution: HomeSummary['contribution'] = null;
    if (ctx.enabledModules.has('rewards')) {
      const points = parts.reduce((sum, p) => sum + (p.points ?? 0), 0);
      const openTasks = parts.reduce((sum, p) => sum + (p.openTasks ?? 0), 0);
      if (points !== 0 || openTasks > 0) contribution = { points, openTasks };
    }

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
      attention: parts.flatMap((p) => p.attention ?? []),
      upcoming,
      notices: parts.flatMap((p) => p.notices ?? []),
      unreadNotifications,
      contribution,
    };
  }

  /** Committee: join requests and invitations still open. */
  private async membersPart(ctx: TenantContext): Promise<HomePart> {
    if (!can(ctx, 'member.manage')) return {};
    const [joinRequests, invitations] = await Promise.all([
      this.tenant.client.joinRequest.count({ where: { status: 'PENDING' } }),
      this.tenant.client.invitation.count({
        where: { status: 'PENDING', expiresAt: { gt: new Date() } },
      }),
    ]);
    const attention: AttentionItem[] = [];
    if (joinRequests > 0) attention.push({ type: 'JOIN_REQUESTS_PENDING', count: joinRequests });
    if (invitations > 0) attention.push({ type: 'INVITATIONS_PENDING', count: invitations });
    return { attention };
  }

  /** Ask for an email when the account has none. */
  private async profilePart(ctx: TenantContext): Promise<HomePart> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: ctx.userId },
      select: { email: true },
    });
    return user.email ? {} : { attention: [{ type: 'PROFILE_INCOMPLETE', missing: ['email'] }] };
  }
}
