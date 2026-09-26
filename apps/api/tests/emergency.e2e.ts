import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auth, societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

describe('emergency', () => {
  it('seeds public numbers; committee manages society contacts', async () => {
    const s = await societyWithResident(h, 'e1');
    const base = `/v1/societies/${s.societyId}/emergency/contacts`;
    const seeded = await h.http().get(base).set(auth(s.resident.token));
    expect(seeded.status).toBe(200);
    expect(seeded.body.map((c: { phone: string }) => c.phone)).toEqual([
      '112',
      '100',
      '101',
      '108',
    ]);
    expect(seeded.body.every((c: { isPublicNumber: boolean }) => c.isPublicNumber)).toBe(true);

    const guard = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({ label: 'Main gate security', phone: '+91 98000 00007', type: 'SECURITY' });
    expect(guard.status).toBe(201);
    expect(guard.body.phone).toBe('+919800000007');
    const list = await h.http().get(base).set(auth(s.resident.token));
    expect(list.body[0].label).toBe('Main gate security');

    const byResident = await h
      .http()
      .post(base)
      .set(auth(s.resident.token))
      .send({ label: 'Me', phone: '123' });
    expect(byResident.status).toBe(403);
    const letters = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({ label: 'Bad', phone: 'call me' });
    expect(letters.status).toBe(400);
    const edit = await h
      .http()
      .patch(`${base}/${guard.body.id}`)
      .set(auth(s.admin))
      .send({ label: 'Gate' });
    expect(edit.body.label).toBe('Gate');
    const del = await h.http().delete(`${base}/${guard.body.id}`).set(auth(s.admin));
    expect(del.status).toBe(200);
  });

  it('raises an alert, notifies the society, shows on Home first, then resolves', async () => {
    const s = await societyWithResident(h, 'e2');
    const base = `/v1/societies/${s.societyId}/emergency/alerts`;
    const raise = await h
      .http()
      .post(base)
      .set(auth(s.resident.token))
      .send({ type: 'FIRE', message: 'Smoke near lift room' });
    expect(raise.status).toBe(201);
    expect(raise.body).toMatchObject({
      type: 'FIRE',
      status: 'ACTIVE',
      message: 'Smoke near lift room',
      canResolve: true,
      flat: { number: '101' },
    });
    expect(raise.body.raisedBy.displayName).toBe('Resident e2');

    const cooldown = await h.http().post(base).set(auth(s.resident.token)).send({ type: 'OTHER' });
    expect(cooldown.status).toBe(429);
    expect(cooldown.body.code).toBe('ALERT_COOLDOWN');

    // The admin is notified, in the EMERGENCY category, with a deep link.
    const notif = await h.http().get('/v1/me/notifications').set(auth(s.admin));
    const alertNote = notif.body.items.find(
      (n: { category: string }) => n.category === 'EMERGENCY',
    );
    expect(alertNote.title).toBe('🚨 Fire alert at 101');
    expect(alertNote.body).toBe('Resident e2: Smoke near lift room');
    expect(alertNote.data).toMatchObject({ screen: 'alert', alertId: raise.body.id });
    const own = await h.http().get('/v1/me/notifications').set(auth(s.resident.token));
    expect(own.body.items.some((n: { category: string }) => n.category === 'EMERGENCY')).toBe(
      false,
    );

    const home = await h.http().get(`/v1/societies/${s.societyId}/home`).set(auth(s.admin));
    expect(home.body.attention[0]).toMatchObject({
      type: 'ACTIVE_ALERT',
      alertId: raise.body.id,
      alertType: 'FIRE',
      raisedByName: 'Resident e2',
    });

    const active = await h.http().get(base).set(auth(s.admin));
    expect(active.body.items).toHaveLength(1);
    expect(active.body.items[0].canResolve).toBe(true);

    const resolve = await h
      .http()
      .post(`${base}/${raise.body.id}/resolve`)
      .set(auth(s.admin))
      .send({ outcome: 'RESOLVED', note: 'Fire brigade came' });
    expect(resolve.status).toBe(201);
    expect(resolve.body).toMatchObject({
      status: 'RESOLVED',
      resolutionNote: 'Fire brigade came',
      canResolve: false,
    });
    expect(resolve.body.resolvedBy.displayName).toBe('Society Admin');
    const twice = await h
      .http()
      .post(`${base}/${raise.body.id}/resolve`)
      .set(auth(s.admin))
      .send({ outcome: 'FALSE_ALARM' });
    expect(twice.status).toBe(409);

    const residentNotes = await h.http().get('/v1/me/notifications').set(auth(s.resident.token));
    expect(residentNotes.body.items[0].title).toBe('✅ Fire alert closed');
    const homeAfter = await h.http().get(`/v1/societies/${s.societyId}/home`).set(auth(s.admin));
    expect(homeAfter.body.attention.some((a: { type: string }) => a.type === 'ACTIVE_ALERT')).toBe(
      false,
    );
    const closed = await h.http().get(`${base}?status=CLOSED`).set(auth(s.resident.token));
    expect(closed.body.items).toHaveLength(1);

    const audit = await h.prisma.auditLog.findMany({
      where: { societyId: s.societyId, action: { startsWith: 'alert.' } },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((a) => a.action)).toEqual(['alert.raised', 'alert.resolved']);
  });

  it('only the raiser or a resolver can close an alert; ROLES setting narrows recipients', async () => {
    const s = await societyWithResident(h, 'e3');
    const base = `/v1/societies/${s.societyId}/emergency/alerts`;
    const invite = await h
      .http()
      .post(`/v1/societies/${s.societyId}/invitations`)
      .set(auth(s.admin))
      .send({ inviteeName: 'Neighbour', flatId: s.flats[1]?.id });
    const neighbour = await h.register('+919811100000', 'Neighbour');
    await h
      .http()
      .post('/v1/join/invite')
      .set(auth(neighbour.token))
      .send({ code: invite.body.code });

    const byAdmin = await h.http().post(base).set(auth(s.admin)).send({ type: 'LIFT' });
    const neighbourClose = await h
      .http()
      .post(`${base}/${byAdmin.body.id}/resolve`)
      .set(auth(neighbour.token))
      .send({ outcome: 'FALSE_ALARM' });
    expect(neighbourClose.status).toBe(403);
    const seen = await h.http().get(`${base}/${byAdmin.body.id}`).set(auth(neighbour.token));
    expect(seen.body.canResolve).toBe(false);
    const raiserClose = await h
      .http()
      .post(`${base}/${byAdmin.body.id}/resolve`)
      .set(auth(s.admin))
      .send({ outcome: 'FALSE_ALARM' });
    expect(raiserClose.body.status).toBe('FALSE_ALARM');

    // The raiser's phone reaches everyone alerted, even residents who cannot see contacts.
    const fromNeighbour = await h
      .http()
      .post(base)
      .set(auth(neighbour.token))
      .send({ type: 'GAS' });
    const asResident = await h
      .http()
      .get(`${base}/${fromNeighbour.body.id}`)
      .set(auth(s.resident.token));
    expect(asResident.body.raisedBy.phone).toBe('+919811100000');
    const member = await h
      .http()
      .get(`/v1/societies/${s.societyId}/members/${fromNeighbour.body.raisedBy.membershipId}`)
      .set(auth(s.resident.token));
    expect(member.body.phone).toBeNull();

    // ROLES with no role ids: only resolvers (admin, committee, staff) are alerted.
    await h
      .http()
      .patch(`/v1/societies/${s.societyId}/modules/emergency`)
      .set(auth(s.admin))
      .send({ settings: { alertRecipients: 'ROLES', roleIds: [] } });
    await h.prisma.notification.deleteMany({});
    const r = await h.http().post(base).set(auth(s.resident.token)).send({ type: 'MEDICAL' });
    expect(r.status).toBe(201);
    const adminN = await h.prisma.notification.count({ where: { category: 'EMERGENCY' } });
    const neighbourN = await h.prisma.notification.count({
      where: { category: 'EMERGENCY', userId: neighbour.userId },
    });
    expect(adminN).toBe(1);
    expect(neighbourN).toBe(0);
  });

  it('cross-tenant: B cannot see or resolve A alerts', async () => {
    const a = await societyWithResident(h, 'ea');
    const b = await societyWithResident(h, 'eb');
    const alertA = await h
      .http()
      .post(`/v1/societies/${a.societyId}/emergency/alerts`)
      .set(auth(a.resident.token))
      .send({ type: 'SECURITY' });
    const direct = await h
      .http()
      .get(`/v1/societies/${a.societyId}/emergency/alerts`)
      .set(auth(b.admin));
    expect(direct.status).toBe(404);
    const viaB = await h
      .http()
      .post(`/v1/societies/${b.societyId}/emergency/alerts/${alertA.body.id}/resolve`)
      .set(auth(b.admin))
      .send({ outcome: 'FALSE_ALARM' });
    expect(viaB.status).toBe(404);
    const listB = await h
      .http()
      .get(`/v1/societies/${b.societyId}/emergency/alerts`)
      .set(auth(b.admin));
    expect(listB.body.items).toEqual([]);
    const bNotified = await h.prisma.notification.count({
      where: { category: 'EMERGENCY', societyId: b.societyId },
    });
    expect(bNotified).toBe(0);
    const raiseForAFlat = await h
      .http()
      .post(`/v1/societies/${b.societyId}/emergency/alerts`)
      .set(auth(b.admin))
      .send({ type: 'FIRE', flatId: a.flats[0]?.id });
    expect(raiseForAFlat.status).toBe(404);
  });
});
