import type { NotificationCategory } from '@movo/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { type PushMessage, type PushResult, PushTransport } from './push.transport';

const BATCH = 200;
/** A delivery that hit a temporary error is retried on later ticks, then marked FAILED. */
export const MAX_ATTEMPTS = 5;
/** These always reach the phone, whatever the member's preferences say. */
const ALWAYS_ON: readonly NotificationCategory[] = ['EMERGENCY', 'MEMBERSHIP'];
/** How long a sender may hold claimed rows. A sender that dies lets them go after this. */
const CLAIM_SECONDS = 120;

/** Queue order: lower goes first. Bill reminders and expense notes wait behind everything else. */
export const EMERGENCY_PRIORITY = 0;
export function deliveryPriority(category: NotificationCategory): number {
  if (category === 'EMERGENCY') return EMERGENCY_PRIORITY;
  if (category === 'MEMBERSHIP' || category === 'SYSTEM') return 1;
  if (category === 'MAINTENANCE' || category === 'EXPENSE') return 3;
  return 2;
}

/**
 * Outbox worker. Pending deliveries become push messages; results are written back.
 *
 * A sender first claims rows (claimedUntil, taken with FOR UPDATE SKIP LOCKED), so the 30 s
 * job on any number of API instances and the immediate EMERGENCY send never pick the same row.
 */
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
      await this.deliverPending();
    } catch (error) {
      this.logger.error(
        `delivery tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** One batch of the queue, most urgent first. */
  async deliverPending(): Promise<number> {
    return this.deliver(await this.claim());
  }

  /**
   * Sends these deliveries now (EMERGENCY, right after the transaction that wrote them). Rows
   * another sender already holds or finished are left alone. Never throws: what is not sent
   * stays PENDING for the job.
   */
  async deliverNow(deliveryIds: string[]): Promise<number> {
    if (deliveryIds.length === 0) return 0;
    try {
      return await this.deliver(await this.claim(deliveryIds));
    } catch (error) {
      this.logger.error(
        `immediate delivery failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 0;
    }
  }

  /** Marks up to BATCH free pending rows as ours and returns their ids. */
  private async claim(onlyIds?: string[]): Promise<string[]> {
    const only = onlyIds ? Prisma.sql`AND "id" = ANY(${onlyIds}::uuid[])` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE "NotificationDelivery"
      SET "claimedUntil" = (now() AT TIME ZONE 'UTC') + make_interval(secs => ${CLAIM_SECONDS})
      WHERE "id" IN (
        SELECT "id" FROM "NotificationDelivery"
        WHERE "status" = 'PENDING' AND "channel" = 'PUSH'
          AND ("claimedUntil" IS NULL OR "claimedUntil" < (now() AT TIME ZONE 'UTC'))
          ${only}
        ORDER BY "priority", "createdAt"
        LIMIT ${BATCH}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id"`;
    return rows.map((r) => r.id);
  }

  private async deliver(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const pending = await this.prisma.notificationDelivery.findMany({
      where: { id: { in: ids } },
      include: {
        notification: {
          include: {
            user: { include: { devices: { select: { token: true } }, preferences: true } },
          },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
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

    // Rows with the same outcome are written together: a handful of updates per batch.
    const attemptsById = new Map(pending.map((d) => [d.id, d.attempts]));
    const deadTokens = new Set<string>();
    const groups = new Map<
      string,
      { data: Prisma.NotificationDeliveryUpdateManyMutationInput; ids: string[] }
    >();
    const now = new Date();
    for (const r of results) {
      for (const token of r.invalidTokens ?? []) deadTokens.add(token);
      const attempts = (attemptsById.get(r.deliveryId) ?? 0) + 1;
      const status =
        r.status === 'RETRY' ? (attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING') : r.status;
      const lastError = r.error ?? null;
      const key = JSON.stringify([status, attempts, lastError]);
      const group = groups.get(key) ?? {
        data: {
          status,
          attempts,
          lastError,
          sentAt: status === 'SENT' ? now : null,
          claimedUntil: null,
        },
        ids: [],
      };
      group.ids.push(r.deliveryId);
      groups.set(key, group);
    }
    for (const { data, ids: groupIds } of groups.values())
      await this.prisma.notificationDelivery.updateMany({ where: { id: { in: groupIds } }, data });
    if (deadTokens.size > 0) {
      const { count } = await this.prisma.deviceToken.deleteMany({
        where: { token: { in: [...deadTokens] } },
      });
      this.logger.log(`removed ${count} dead device token(s)`);
    }
    return results.length;
  }
}
