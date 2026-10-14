import type { NotificationCategory } from '@movo/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TenantPrismaService } from '../src/common/prisma/tenant-prisma.service';
import { DeliveryJob, MAX_ATTEMPTS } from '../src/modules/notifications/delivery.job';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import {
  type PushMessage,
  type PushResult,
  PushTransport,
} from '../src/modules/notifications/push.transport';
import { societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

class FakeTransport extends PushTransport {
  readonly configured = true;
  sent: PushMessage[] = [];
  constructor(private readonly answer: (m: PushMessage) => PushResult) {
    super();
  }
  async send(messages: PushMessage[]): Promise<PushResult[]> {
    this.sent.push(...messages);
    return messages.map(this.answer);
  }
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });
const TOKEN_A = 'fcm-token-aaaaaaaaaaaa';
const TOKEN_B = 'fcm-token-bbbbbbbbbbbb';

async function setup() {
  const user = await h.register('push@movo.test', 'Push');
  for (const token of [TOKEN_A, TOKEN_B]) {
    const res = await h
      .http()
      .post('/v1/me/devices')
      .set(auth(user.token))
      .send({ token, platform: 'ANDROID', appVersion: '0.1.0' });
    expect(res.status).toBe(201);
  }
  /** With a transport, EMERGENCY pushes go out through it at once (else the app's no-op one). */
  const notify = (
    category: NotificationCategory,
    societyId: string | null = null,
    transport?: PushTransport,
  ) =>
    (transport
      ? new NotificationsService(h.app.get(PrismaService), job(transport))
      : h.app.get(NotificationsService)
    ).notifyUsers({
      userIds: [user.userId],
      societyId,
      category,
      render: () => ({ title: 'Hello', body: 'World' }),
      data: { screen: 'notice', noticeId: 'n1', count: 3 },
    });
  return { user, notify };
}

const job = (t: PushTransport) => new DeliveryJob(h.app.get(PrismaService), t);

describe('push delivery job', () => {
  it('sends to every device with string data, then marks SENT', async () => {
    const { notify } = await setup();
    await notify('NOTICE');
    const t = new FakeTransport((m) => ({ deliveryId: m.deliveryId, status: 'SENT' }));
    expect(await job(t).deliverPending()).toBe(1);
    expect(t.sent[0]?.tokens.sort()).toEqual([TOKEN_A, TOKEN_B]);
    expect(t.sent[0]?.category).toBe('NOTICE');
    expect(t.sent[0]?.data).toMatchObject({ screen: 'notice', noticeId: 'n1', count: '3' });
    expect(t.sent[0]?.data.notificationId).toBeTruthy();
    const d = await h.prisma.notificationDelivery.findFirstOrThrow();
    expect(d.status).toBe('SENT');
    expect(d.attempts).toBe(1);
    expect(d.sentAt).not.toBeNull();
  });

  it('deletes tokens FCM reports as dead', async () => {
    const { notify } = await setup();
    await notify('NOTICE');
    const t = new FakeTransport((m) => ({
      deliveryId: m.deliveryId,
      status: 'SENT',
      invalidTokens: [TOKEN_B],
    }));
    await job(t).deliverPending();
    const tokens = await h.prisma.deviceToken.findMany();
    expect(tokens.map((x) => x.token)).toEqual([TOKEN_A]);
  });

  it('keeps a delivery pending on a temporary error, then fails it after the last attempt', async () => {
    const { notify } = await setup();
    await notify('NOTICE');
    const t = new FakeTransport((m) => ({
      deliveryId: m.deliveryId,
      status: 'RETRY',
      error: '503',
    }));
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await job(t).deliverPending();
      const d = await h.prisma.notificationDelivery.findFirstOrThrow();
      expect(d.status).toBe('PENDING');
      expect(d.attempts).toBe(i);
    }
    await job(t).deliverPending();
    const d = await h.prisma.notificationDelivery.findFirstOrThrow();
    expect(d.status).toBe('FAILED');
    expect(d.lastError).toBe('503');
    expect(await job(t).deliverPending()).toBe(0);
  });

  it('skips a category the member muted, but never EMERGENCY', async () => {
    const { user, notify } = await setup();
    const platform = await h.makePlatformAdmin();
    const { societyId } = await h.createSociety(platform.token, 'Sunrise', 'admin@sunrise.test');
    for (const category of ['NOTICE', 'EMERGENCY'] as const)
      await h.prisma.notificationPreference.create({
        data: { userId: user.userId, societyId, category, pushEnabled: false },
      });
    const t = new FakeTransport((m) => ({ deliveryId: m.deliveryId, status: 'SENT' }));
    await notify('NOTICE', societyId, t);
    await notify('EMERGENCY', societyId, t);
    await job(t).deliverPending();
    expect(t.sent.map((m) => m.category)).toEqual(['EMERGENCY']);
    const rows = await h.prisma.notificationDelivery.findMany({
      include: { notification: true },
    });
    const notice = rows.find((r) => r.notification.category === 'NOTICE');
    expect(notice?.status).toBe('SKIPPED');
    expect(notice?.lastError).toBe('muted by preference');
  });

  it('skips users without a device', async () => {
    const { user, notify } = await setup();
    await h.http().delete('/v1/me/devices').set(auth(user.token)).send({ token: TOKEN_A });
    await h.http().delete('/v1/me/devices').set(auth(user.token)).send({ token: TOKEN_B });
    await notify('NOTICE');
    const t = new FakeTransport((m) => ({ deliveryId: m.deliveryId, status: 'SENT' }));
    await job(t).deliverPending();
    expect(t.sent).toHaveLength(0);
    const d = await h.prisma.notificationDelivery.findFirstOrThrow();
    expect(d.status).toBe('SKIPPED');
  });

  it('sends an EMERGENCY push at once, and the job never sends it again', async () => {
    const { notify } = await setup();
    const t = new FakeTransport((m) => ({ deliveryId: m.deliveryId, status: 'SENT' }));
    await notify('NOTICE', null, t);
    await notify('EMERGENCY', null, t);
    // No job ran: only the emergency went out.
    expect(t.sent.map((m) => m.category)).toEqual(['EMERGENCY']);
    const rows = await h.prisma.notificationDelivery.findMany({ include: { notification: true } });
    const sos = rows.find((r) => r.notification.category === 'EMERGENCY');
    expect(sos).toMatchObject({ status: 'SENT', attempts: 1, claimedUntil: null });
    expect(sos?.priority).toBe(0);
    await job(t).deliverPending();
    await job(t).deliverPending();
    expect(t.sent.map((m) => m.category)).toEqual(['EMERGENCY', 'NOTICE']);
  });

  it('works through the queue by priority, then age', async () => {
    const { notify } = await setup();
    await notify('MAINTENANCE');
    await notify('NOTICE');
    await notify('MEMBERSHIP');
    const t = new FakeTransport((m) => ({ deliveryId: m.deliveryId, status: 'SENT' }));
    await job(t).deliverPending();
    expect(t.sent.map((m) => m.category)).toEqual(['MEMBERSHIP', 'NOTICE', 'MAINTENANCE']);
  });

  it('lets two senders share the queue without sending a row twice', async () => {
    const { notify } = await setup();
    for (let i = 0; i < 12; i++) await notify('NOTICE');
    const slow = () =>
      new (class extends FakeTransport {
        override async send(messages: PushMessage[]) {
          await new Promise((r) => setTimeout(r, 50));
          return super.send(messages);
        }
      })((m) => ({ deliveryId: m.deliveryId, status: 'SENT' }));
    const [a, b] = [slow(), slow()];
    await Promise.all([job(a).deliverPending(), job(b).deliverPending(), job(a).deliverPending()]);
    const ids = [...a.sent, ...b.sent].map((m) => m.deliveryId);
    expect(ids).toHaveLength(12);
    expect(new Set(ids).size).toBe(12);
    expect(await h.prisma.notificationDelivery.count({ where: { status: 'SENT' } })).toBe(12);
  });

  it('leaves a claimed row alone until the claim runs out', async () => {
    const { notify } = await setup();
    await notify('NOTICE');
    const t = new FakeTransport((m) => ({ deliveryId: m.deliveryId, status: 'SENT' }));
    await h.prisma.notificationDelivery.updateMany({
      data: { claimedUntil: new Date(Date.now() + 60_000) },
    });
    expect(await job(t).deliverPending()).toBe(0);
    // The sender holding it died: once the claim is over, the job picks it up.
    await h.prisma.notificationDelivery.updateMany({
      data: { claimedUntil: new Date(Date.now() - 1_000) },
    });
    expect(await job(t).deliverPending()).toBe(1);
    expect(t.sent).toHaveLength(1);
  });

  it('delivers an SOS from the API without waiting for the job', async () => {
    const s = await societyWithResident(h, 'sos-now');
    await h
      .http()
      .post('/v1/me/devices')
      .set(auth(s.resident.token))
      .send({ token: TOKEN_A, platform: 'ANDROID', appVersion: '0.1.0' });
    const raised = await h
      .http()
      .post(`/v1/societies/${s.societyId}/emergency/alerts`)
      .set(auth(s.admin))
      .send({ type: 'MEDICAL' });
    expect(raised.status).toBe(201);
    const rows = await h.prisma.notificationDelivery.findMany({
      where: { notification: { category: 'EMERGENCY', userId: s.resident.userId } },
    });
    // Tests run without Firebase: the no-op transport answered, so the row is done, not queued.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'SKIPPED',
      attempts: 1,
      lastError: 'push not configured',
    });
  });

  it('writes a push with the caller’s transaction and sends an emergency only after commit', async () => {
    const { user } = await setup();
    const t = new FakeTransport((m) => ({ deliveryId: m.deliveryId, status: 'SENT' }));
    const notifications = new NotificationsService(h.app.get(PrismaService), job(t));
    const tenant = h.app.get(TenantPrismaService);
    const sos = {
      userIds: [user.userId],
      societyId: null,
      category: 'EMERGENCY' as const,
      render: () => ({ title: 'SOS', body: 'Gate' }),
    };

    // Rolled back: no notification, no outbox row, nothing sent.
    await expect(
      tenant.tx(async (tx) => {
        await notifications.notifyUsers(sos, tx);
        throw new Error('write failed');
      }),
    ).rejects.toThrow('write failed');
    expect(await h.prisma.notification.count()).toBe(0);
    expect(t.sent).toHaveLength(0);

    // Committed: sent once the transaction is over, not inside it.
    await tenant.tx(async (tx) => {
      await notifications.notifyUsers(sos, tx);
      expect(t.sent).toHaveLength(0);
    });
    expect(t.sent).toHaveLength(1);
    expect(await h.prisma.notificationDelivery.findFirstOrThrow()).toMatchObject({
      status: 'SENT',
    });
  });
});
