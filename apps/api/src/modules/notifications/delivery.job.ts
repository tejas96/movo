import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { withJobLock } from '../../common/jobs/job-lock';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PushTransport } from './push.transport';

const BATCH = 200;

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
      include: { notification: { include: { user: { include: { devices: true } } } } },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });
    if (pending.length === 0) return 0;
    const messages = pending.map((d) => ({
      deliveryId: d.id,
      tokens: d.notification.user.devices.map((x) => x.token),
      title: d.notification.title,
      body: d.notification.body,
      data: Object.fromEntries(
        Object.entries((d.notification.data ?? {}) as Record<string, unknown>).map(([k, v]) => [
          k,
          String(v),
        ]),
      ),
    }));
    const results = await this.transport.send(messages);
    for (const r of results) {
      await this.prisma.notificationDelivery.update({
        where: { id: r.deliveryId },
        data: {
          status: r.status,
          attempts: { increment: 1 },
          lastError: r.error ?? null,
          sentAt: r.status === 'SENT' ? new Date() : null,
        },
      });
    }
    return results.length;
  }
}
