import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { DeliveryJob, MAX_ATTEMPTS } from '../src/modules/notifications/delivery.job';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import {
  type PushMessage,
  type PushResult,
  PushTransport,
} from '../src/modules/notifications/push.transport';
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
  const notifications = h.app.get(NotificationsService);
  const notify = (category: 'NOTICE' | 'EMERGENCY', societyId: string | null = null) =>
    notifications.notifyUsers({
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
    await notify('NOTICE', societyId);
    await notify('EMERGENCY', societyId);
    const t = new FakeTransport((m) => ({ deliveryId: m.deliveryId, status: 'SENT' }));
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
});
