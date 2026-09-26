import type { AttentionItem, HomeSummary } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can } from '../../common/tenant/tenant.types';
import { NoticesService } from '../notices/notices.service';
import { NotificationsService } from '../notifications/notifications.service';

/** The server decides what matters today. The app only renders. */
@Injectable()
export class HomeService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly notices: NoticesService,
    private readonly notifications: NotificationsService,
  ) {}

  async summary(): Promise<HomeSummary> {
    const ctx = requireTenant();
    const attention: AttentionItem[] = [];

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
      notices,
      unreadNotifications: await this.notifications.unreadCount(ctx.userId),
    };
  }
}
