import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { societyWithResident } from './fixtures';
import { createHarness, type Harness, login } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe('tenancy', () => {
  it('platform admin creates a society; the first admin sees it in context with admin permissions', async () => {
    const platform = await h.makePlatformAdmin();
    const { societyId, joinCode } = await h.createSociety(
      platform.token,
      'Sunrise Residency',
      'admin@sunrise.test',
    );
    expect(joinCode).toHaveLength(6);
    const adminToken = await login(h, 'admin@sunrise.test');
    const ctx = await h.http().get('/v1/me/context').set(auth(adminToken));
    expect(ctx.status).toBe(200);
    expect(ctx.body.memberships).toHaveLength(1);
    expect(ctx.body.memberships[0].society.id).toBe(societyId);
    expect(ctx.body.memberships[0].permissions).toContain('member.manage');
    expect(
      ctx.body.memberships[0].modules.find((m: { key: string }) => m.key === 'marketplace').enabled,
    ).toBe(false);
    const nonAdmin = await h.register('nobody@movo.test');
    const denied = await h
      .http()
      .post('/v1/platform/societies')
      .set(auth(nonAdmin.token))
      .send({ name: 'X', admin: { identifier: 'x@x.test', displayName: 'X' } });
    expect(denied.status).toBe(403);
  });

  it('admin builds structure, invites a resident, resident joins by code and sees home', async () => {
    const platform = await h.makePlatformAdmin();
    const { societyId } = await h.createSociety(
      platform.token,
      'Sunrise Residency',
      'admin@sunrise.test',
    );
    const admin = await login(h, 'admin@sunrise.test');

    const wing = await h
      .http()
      .post(`/v1/societies/${societyId}/buildings`)
      .set(auth(admin))
      .send({ name: 'A', floorsCount: 4 });
    expect(wing.status).toBe(201);
    const flats = await h
      .http()
      .post(`/v1/societies/${societyId}/flats`)
      .set(auth(admin))
      .send({
        flats: [
          { buildingId: wing.body.id, number: '101', floor: 1 },
          { buildingId: wing.body.id, number: '102', floor: 1 },
        ],
      });
    expect(flats.status).toBe(201);
    expect(flats.body).toHaveLength(2);

    const invite = await h
      .http()
      .post(`/v1/societies/${societyId}/invitations`)
      .set(auth(admin))
      .send({ inviteeName: 'Tejas Patil', flatId: flats.body[0].id, relation: 'OWNER' });
    expect(invite.status).toBe(201);
    expect(invite.body.code).toHaveLength(8);

    const resident = await h.register('resident@movo.test', 'Tejas Patil');
    const before = await h.http().get(`/v1/societies/${societyId}/home`).set(auth(resident.token));
    expect(before.status).toBe(404); // not a member yet: society is invisible

    const joined = await h
      .http()
      .post('/v1/join/invite')
      .set(auth(resident.token))
      .send({ code: invite.body.code.toLowerCase() });
    expect(joined.status).toBe(201);
    const again = await h
      .http()
      .post('/v1/join/invite')
      .set(auth(resident.token))
      .send({ code: invite.body.code });
    expect(again.status).toBe(400); // code is used up

    const home = await h.http().get(`/v1/societies/${societyId}/home`).set(auth(resident.token));
    expect(home.status).toBe(200);
    expect(home.body.flats[0].number).toBe('101');
    expect(home.body.flats[0].relation).toBe('OWNER');

    const ctx = await h.http().get('/v1/me/context').set(auth(resident.token));
    expect(ctx.body.memberships[0].roles[0].key).toBe('resident');
    expect(ctx.body.memberships[0].permissions).toEqual([]);

    // Residents cannot manage members; admins can.
    const denied = await h
      .http()
      .post(`/v1/societies/${societyId}/invitations`)
      .set(auth(resident.token))
      .send({ inviteeName: 'X' });
    expect(denied.status).toBe(403);
    const members = await h.http().get(`/v1/societies/${societyId}/members`).set(auth(admin));
    expect(members.status).toBe(200);
    expect(members.body.items).toHaveLength(2);
  });

  it('join request flow: resident asks, admin approves, membership becomes active', async () => {
    const platform = await h.makePlatformAdmin();
    const { societyId, joinCode } = await h.createSociety(
      platform.token,
      'Sunrise Residency',
      'admin@sunrise.test',
    );
    const admin = await login(h, 'admin@sunrise.test');
    const flats = await h
      .http()
      .post(`/v1/societies/${societyId}/flats`)
      .set(auth(admin))
      .send({ flats: [{ number: '201' }] });

    const resident = await h.register('+919876500001', 'Rahul');
    const preview = await h
      .http()
      .get(`/v1/join/societies/${joinCode.toLowerCase()}`)
      .set(auth(resident.token));
    expect(preview.status).toBe(200);
    expect(preview.body.flats).toHaveLength(1);
    const req = await h
      .http()
      .post('/v1/join/request')
      .set(auth(resident.token))
      .send({ joinCode, flatId: flats.body[0].id, relation: 'TENANT' });
    expect(req.status).toBe(201);

    const adminHome = await h.http().get(`/v1/societies/${societyId}/home`).set(auth(admin));
    expect(
      adminHome.body.attention.some((a: { type: string }) => a.type === 'JOIN_REQUESTS_PENDING'),
    ).toBe(true);
    const adminNotifications = await h.http().get('/v1/me/notifications').set(auth(admin));
    expect(adminNotifications.body.items[0].category).toBe('MEMBERSHIP');

    const list = await h.http().get(`/v1/societies/${societyId}/join-requests`).set(auth(admin));
    expect(list.body).toHaveLength(1);
    const approve = await h
      .http()
      .post(`/v1/societies/${societyId}/join-requests/${req.body.id}/approve`)
      .set(auth(admin))
      .send({});
    expect(approve.status).toBe(201);
    expect(approve.body.flats[0].relation).toBe('TENANT');

    const home = await h.http().get(`/v1/societies/${societyId}/home`).set(auth(resident.token));
    expect(home.status).toBe(200);
    const notif = await h.http().get('/v1/me/notifications').set(auth(resident.token));
    expect(notif.body.items[0].title).toContain('Sunrise Residency');
  });

  it('cross-tenant isolation: a member of society B never sees society A', async () => {
    const platform = await h.makePlatformAdmin();
    const a = await h.createSociety(platform.token, 'Society A', 'admin-a@movo.test');
    const b = await h.createSociety(platform.token, 'Society B', 'admin-b@movo.test');
    const adminA = await login(h, 'admin-a@movo.test');
    const adminB = await login(h, 'admin-b@movo.test');
    const flatA = await h
      .http()
      .post(`/v1/societies/${a.societyId}/flats`)
      .set(auth(adminA))
      .send({ flats: [{ number: '1' }] });
    const noticeA = await h
      .http()
      .post(`/v1/societies/${a.societyId}/notices`)
      .set(auth(adminA))
      .send({ title: 'Secret of A', body: 'only A' });
    expect(noticeA.status).toBe(201);

    for (const path of [
      `/v1/societies/${a.societyId}`,
      `/v1/societies/${a.societyId}/home`,
      `/v1/societies/${a.societyId}/members`,
      `/v1/societies/${a.societyId}/flats`,
      `/v1/societies/${a.societyId}/notices`,
      `/v1/societies/${a.societyId}/notices/${noticeA.body.id}`,
      `/v1/societies/${a.societyId}/invitations`,
    ]) {
      const res = await h.http().get(path).set(auth(adminB));
      expect(res.status, path).toBe(404);
    }
    const write = await h
      .http()
      .patch(`/v1/societies/${a.societyId}/flats/${flatA.body[0].id}`)
      .set(auth(adminB))
      .send({ number: 'hacked' });
    expect(write.status).toBe(404);
    // B's own society still works.
    const own = await h.http().get(`/v1/societies/${b.societyId}`).set(auth(adminB));
    expect(own.status).toBe(200);
  });

  it('keeps the last admin and hides phone numbers unless allowed', async () => {
    const platform = await h.makePlatformAdmin();
    const { societyId, adminMembershipId } = await h.createSociety(
      platform.token,
      'Sunrise Residency',
      '+919999900001',
    );
    const admin = await login(h, '+919999900001');
    const roles = await h.http().get(`/v1/societies/${societyId}/roles`).set(auth(admin));
    const residentRole = roles.body.find((r: { key: string }) => r.key === 'resident');
    const demote = await h
      .http()
      .patch(`/v1/societies/${societyId}/members/${adminMembershipId}`)
      .set(auth(admin))
      .send({ roleIds: [residentRole.id] });
    expect(demote.status).toBe(409);
    expect(demote.body.code).toBe('LAST_ADMIN');

    const invite = await h
      .http()
      .post(`/v1/societies/${societyId}/invitations`)
      .set(auth(admin))
      .send({ inviteeName: 'Res' });
    const resident = await h.register('+919876500002', 'Resident');
    await h
      .http()
      .post('/v1/join/invite')
      .set(auth(resident.token))
      .send({ code: invite.body.code });
    const asResident = await h
      .http()
      .get(`/v1/societies/${societyId}/members`)
      .set(auth(resident.token));
    const adminCard = asResident.body.items.find(
      (m: { membershipId: string }) => m.membershipId === adminMembershipId,
    );
    expect(adminCard.phone).toBeNull();
    const asAdmin = await h.http().get(`/v1/societies/${societyId}/members`).set(auth(admin));
    const residentCard = asAdmin.body.items.find(
      (m: { displayName: string }) => m.displayName === 'Resident',
    );
    expect(residentCard.phone).toBe('+919876500002');
  });
});

describe('my privacy', () => {
  it('reads back what I saved and respects the society phone setting', async () => {
    const s = await societyWithResident(h, 'p1');
    const url = `/v1/societies/${s.societyId}/members/me/privacy`;
    const first = await h.http().get(url).set(auth(s.resident.token));
    expect(first.body).toEqual({ showPhone: false, showEmail: false, phoneOptInAllowed: true });
    await h
      .http()
      .patch(url)
      .set(auth(s.resident.token))
      .send({ showPhone: true, showEmail: true });
    const saved = await h.http().get(url).set(auth(s.resident.token));
    expect(saved.body).toEqual({ showPhone: true, showEmail: true, phoneOptInAllowed: true });

    await h
      .http()
      .patch(`/v1/societies/${s.societyId}/modules/directory`)
      .set(auth(s.admin))
      .send({ settings: { allowPhoneOptIn: false } });
    const off = await h.http().get(url).set(auth(s.resident.token));
    expect(off.body).toEqual({ showPhone: false, showEmail: true, phoneOptInAllowed: false });
  });
});
