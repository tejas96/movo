import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHarness, type Harness, login } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe('notices', () => {
  it('publishes, lists pinned first, marks read, notifies the audience, respects audience by flat', async () => {
    const platform = await h.makePlatformAdmin();
    const { societyId } = await h.createSociety(
      platform.token,
      'Sunrise Residency',
      'admin@sunrise.test',
    );
    const admin = await login(h, 'admin@sunrise.test');
    const flats = await h
      .http()
      .post(`/v1/societies/${societyId}/flats`)
      .set(auth(admin))
      .send({ flats: [{ number: '101' }, { number: '102' }] });
    const inv1 = await h
      .http()
      .post(`/v1/societies/${societyId}/invitations`)
      .set(auth(admin))
      .send({ inviteeName: 'R1', flatId: flats.body[0].id });
    const inv2 = await h
      .http()
      .post(`/v1/societies/${societyId}/invitations`)
      .set(auth(admin))
      .send({ inviteeName: 'R2', flatId: flats.body[1].id });
    const r1 = await h.register('r1@movo.test', 'R1');
    const r2 = await h.register('r2@movo.test', 'R2');
    await h.http().post('/v1/join/invite').set(auth(r1.token)).send({ code: inv1.body.code });
    await h.http().post('/v1/join/invite').set(auth(r2.token)).send({ code: inv2.body.code });

    const general = await h
      .http()
      .post(`/v1/societies/${societyId}/notices`)
      .set(auth(admin))
      .send({
        title: 'Water off tomorrow',
        body: '10 AM to 2 PM',
        category: 'WATER',
        priority: 'IMPORTANT',
      });
    expect(general.status).toBe(201);
    const pinned = await h
      .http()
      .post(`/v1/societies/${societyId}/notices`)
      .set(auth(admin))
      .send({ title: 'Pinned rules', body: 'Keep the gate closed', isPinned: true });
    const only101 = await h
      .http()
      .post(`/v1/societies/${societyId}/notices`)
      .set(auth(admin))
      .send({
        title: 'For 101 only',
        body: 'Your parcel',
        audience: { type: 'FLATS', ids: [flats.body[0].id] },
      });
    const draft = await h
      .http()
      .post(`/v1/societies/${societyId}/notices`)
      .set(auth(admin))
      .send({ title: 'Draft', body: 'not yet', publish: false });
    expect(draft.body.status).toBe('DRAFT');

    const asR2 = await h.http().get(`/v1/societies/${societyId}/notices`).set(auth(r2.token));
    expect(asR2.status).toBe(200);
    expect(asR2.body.items.map((n: { title: string }) => n.title)).toEqual([
      'Pinned rules',
      'Water off tomorrow',
    ]);
    const asR1 = await h.http().get(`/v1/societies/${societyId}/notices`).set(auth(r1.token));
    expect(asR1.body.items.map((n: { title: string }) => n.title)).toEqual([
      'Pinned rules',
      'For 101 only',
      'Water off tomorrow',
    ]);

    const hidden = await h
      .http()
      .get(`/v1/societies/${societyId}/notices/${only101.body.id}`)
      .set(auth(r2.token));
    expect(hidden.status).toBe(404);
    const drafts = await h
      .http()
      .get(`/v1/societies/${societyId}/notices?status=DRAFT`)
      .set(auth(r2.token));
    expect(drafts.status).toBe(403);

    const homeBefore = await h.http().get(`/v1/societies/${societyId}/home`).set(auth(r2.token));
    expect(
      homeBefore.body.attention.some((a: { type: string }) => a.type === 'IMPORTANT_NOTICE'),
    ).toBe(true);
    const read = await h
      .http()
      .get(`/v1/societies/${societyId}/notices/${general.body.id}`)
      .set(auth(r2.token));
    expect(read.status).toBe(200);
    expect(read.body.readAt).not.toBeNull();
    expect(read.body.readCount).toBeNull();
    const homeAfter = await h.http().get(`/v1/societies/${societyId}/home`).set(auth(r2.token));
    expect(
      homeAfter.body.attention.some((a: { type: string }) => a.type === 'IMPORTANT_NOTICE'),
    ).toBe(false);

    const asAdmin = await h
      .http()
      .get(`/v1/societies/${societyId}/notices/${general.body.id}`)
      .set(auth(admin));
    expect(asAdmin.body.readCount).toBe(2); // r2 plus the admin's own open

    const notif = await h.http().get('/v1/me/notifications').set(auth(r2.token));
    expect(notif.body.items.map((n: { title: string }) => n.title)).toEqual([
      'Pinned rules',
      '❗ Water off tomorrow',
    ]);
    expect(notif.body.unreadCount).toBe(2);
    const deliveries = await h.prisma.notificationDelivery.count({ where: { status: 'PENDING' } });
    expect(deliveries).toBeGreaterThan(0);

    const publish = await h
      .http()
      .post(`/v1/societies/${societyId}/notices/${draft.body.id}/publish`)
      .set(auth(admin));
    expect(publish.body.status).toBe('PUBLISHED');
    const archive = await h
      .http()
      .post(`/v1/societies/${societyId}/notices/${pinned.body.id}/archive`)
      .set(auth(admin));
    expect(archive.body.status).toBe('ARCHIVED');
    const byResident = await h
      .http()
      .post(`/v1/societies/${societyId}/notices/${draft.body.id}/archive`)
      .set(auth(r1.token));
    expect(byResident.status).toBe(403);
  });
});
