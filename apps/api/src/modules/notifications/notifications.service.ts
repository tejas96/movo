import type {
  Locale,
  NotificationCategory,
  Notification as NotificationDto,
} from '@movo/contracts';
import { createI18n, type TFunction } from '@movo/i18n';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { afterCursor, decodeCursor, slicePage } from '../../common/util/pagination';
import type { Prisma } from '../../generated/prisma/client';
import { DeliveryJob, deliveryPriority } from './delivery.job';

export interface NotifyInput {
  userIds: string[];
  societyId: string | null;
  category: NotificationCategory;
  /** Called once per locale in the recipient set. */
  render: (t: TFunction, locale: Locale) => { title: string; body: string };
  data?: Record<string, unknown>;
  /** Leave this user out, usually the person whose action caused the push. */
  exceptUserId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly delivery: DeliveryJob,
  ) {}

  /**
   * Writes one notification per recipient in their language plus a pending push delivery.
   * EMERGENCY pushes are sent at once instead of waiting for the next job tick.
   */
  async notifyUsers(input: NotifyInput): Promise<number> {
    const userIds = [...new Set(input.userIds)].filter((id) => id !== input.exceptUserId);
    if (userIds.length === 0) return 0;
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, status: 'ACTIVE' },
      select: { id: true, locale: true },
    });
    if (users.length === 0) return 0;
    const byLocale = new Map<Locale, string[]>();
    for (const u of users) byLocale.set(u.locale, [...(byLocale.get(u.locale) ?? []), u.id]);

    const rows: Prisma.NotificationCreateManyInput[] = [];
    for (const [locale, ids] of byLocale) {
      const t = createI18n({ locale }).getFixedT(locale);
      const { title, body } = input.render(t, locale);
      for (const userId of ids) {
        rows.push({
          userId,
          societyId: input.societyId,
          category: input.category,
          title,
          body,
          data: (input.data ?? {}) as Prisma.InputJsonValue,
        });
      }
    }
    const created = await this.prisma.notification.createManyAndReturn({
      data: rows,
      select: { id: true },
    });
    const priority = deliveryPriority(input.category);
    const deliveries = await this.prisma.notificationDelivery.createManyAndReturn({
      data: created.map((n) => ({ notificationId: n.id, channel: 'PUSH' as const, priority })),
      select: { id: true },
    });
    if (input.category === 'EMERGENCY') await this.delivery.deliverNow(deliveries.map((d) => d.id));
    return created.length;
  }

  async list(userId: string, cursorRaw: string | undefined, limit: number) {
    const cursor = decodeCursor(cursorRaw);
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...afterCursor(cursor),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const page = slicePage(rows, limit);
    const unreadCount = await this.unreadCount(userId);
    return { items: page.items.map(toDto), nextCursor: page.nextCursor, unreadCount };
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}

function toDto(n: {
  id: string;
  societyId: string | null;
  category: NotificationCategory;
  title: string;
  body: string;
  data: unknown;
  readAt: Date | null;
  createdAt: Date;
}): NotificationDto {
  return {
    id: n.id,
    societyId: n.societyId,
    category: n.category,
    title: n.title,
    body: n.body,
    data: (n.data ?? {}) as Record<string, unknown>,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}
