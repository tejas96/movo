import type { NotificationCategory } from '@movo/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { withJobLock } from '../../common/jobs/job-lock';
import { PrismaService } from '../../common/prisma/prisma.service';
import { type PushMessage, type PushResult, PushTransport } from './push.transport';

const BATCH = 200;
/** A delivery that hit a temporary error is retried on later ticks, then marked FAILED. */
export const MAX_ATTEMPTS = 5;
/** These always reach the phone, whatever the member's preferences say. */
const ALWAYS_ON: readonly NotificationCategory[] = ['EMERGENCY', 'MEMBERSHIP'];

/** Outbox worker. Pending deliveries become push messages; results are written back. */
@Injectable()
export class DeliveryJob {
  private readonly logger = new Logger(DeliveryJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transport: PushTransport,
  ) {}

  @Interval(30_000)
  async tick(): Promise<void> {
    try {
      await withJobLock(this.prisma, 'movo:deliveries', () => this.deliverPending());
    } catch (error) {
      this.logger.error(
        `delivery tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deliverPending(): Promise<number> {
    const pending = await this.prisma.notificationDelivery.findMany({
      where: { status: 'PENDING', channel: 'PUSH' },
      include: {
        notification: {
          include: {
            user: { include: { devices: { select: { token: true } }, preferences: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });
    if (pending.length === 0) return 0;

    const results: PushResult[] = [];
    const messages: PushMessage[] = [];
    for (const d of pending) {
      const n = d.notification;
      const muted =
        !ALWAYS_ON.includes(n.category) &&
        n.societyId !== null &&
        n.user.preferences.some(
          (p) => p.societyId === n.societyId && p.category === n.category && !p.pushEnabled,
        );
      if (muted) {
        results.push({ deliveryId: d.id, status: 'SKIPPED', error: 'muted by preference' });
        continue;
      }
      if (n.user.devices.length === 0) {
        results.push({ deliveryId: d.id, status: 'SKIPPED', error: 'no device' });
        continue;
      }
      messages.push({
        deliveryId: d.id,
        category: n.category,
        tokens: n.user.devices.map((x) => x.token),
        title: n.title,
        body: n.body,
        data: {
          ...Object.fromEntries(
            Object.entries((n.data ?? {}) as Record<string, unknown>).map(([k, v]) => [
              k,
              String(v),
            ]),
          ),
          notificationId: n.id,
          ...(n.societyId ? { societyId: n.societyId } : {}),
        },
      });
    }
    if (messages.length > 0) results.push(...(await this.transport.send(messages)));

    const attemptsById = new Map(pending.map((d) => [d.id, d.attempts]));
    const deadTokens = new Set<string>();
    for (const r of results) {
      for (const token of r.invalidTokens ?? []) deadTokens.add(token);
      const attempts = (attemptsById.get(r.deliveryId) ?? 0) + 1;
      const status =
        r.status === 'RETRY' ? (attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING') : r.status;
      await this.prisma.notificationDelivery.update({
        where: { id: r.deliveryId },
        data: {
          status,
          attempts,
          lastError: r.error ?? null,
          sentAt: status === 'SENT' ? new Date() : null,
        },
      });
    }
    if (deadTokens.size > 0) {
      const { count } = await this.prisma.deviceToken.deleteMany({
        where: { token: { in: [...deadTokens] } },
      });
      this.logger.log(`removed ${count} dead device token(s)`);
    }
    return results.length;
  }
}
