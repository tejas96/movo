import { PERMISSION_KEYS } from '@movo/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auth, type SocietyFixture, societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const url = (s: SocietyFixture, rest = '') => `/v1/societies/${s.societyId}${rest}`;

async function roles(s: SocietyFixture) {
  const res = await h.http().get(url(s, '/roles')).set(auth(s.admin));
  return res.body as { id: string; key: string; name: string; permissions: string[] }[];
}

describe('roles', () => {
  it('adds, edits and deletes a role, and keeps the admin role complete', async () => {
    const s = await societyWithResident(h, 'r1');
    const created = await h
      .http()
      .post(url(s, '/roles'))
      .set(auth(s.admin))
      .send({ name: 'Security head', permissions: ['emergency.alert.resolve', 'parking.manage'] });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: 'Security head',
      isSystem: false,
      permissions: ['emergency.alert.resolve', 'parking.manage'],
      memberCount: 0,
    });

    const dup = await h
      .http()
      .post(url(s, '/roles'))
      .set(auth(s.admin))
      .send({ name: 'security HEAD', permissions: [] });
    expect(dup.status).toBe(409);

    const edited = await h
      .http()
      .patch(url(s, `/roles/${created.body.id}`))
      .set(auth(s.admin))
      .send({ name: 'Security', permissions: ['parking.manage'] });
    expect(edited.body).toMatchObject({ name: 'Security', permissions: ['parking.manage'] });

    const admin = (await roles(s)).find((r) => r.key === 'admin');
    const shrink = await h
      .http()
      .patch(url(s, `/roles/${admin?.id}`))
      .set(auth(s.admin))
      .send({ permissions: ['notice.publish'] });
    expect(shrink.status).toBe(403);
    const rename = await h
      .http()
      .patch(url(s, `/roles/${admin?.id}`))
      .set(auth(s.admin))
      .send({ name: 'Chairman', permissions: [...PERMISSION_KEYS] });
    expect(rename.status).toBe(200);

    const resident = (await roles(s)).find((r) => r.key === 'resident');
    const delSystem = await h
      .http()
      .delete(url(s, `/roles/${resident?.id}`))
      .set(auth(s.admin));
    expect(delSystem.status).toBe(403);

    // A role in use cannot go.
    await h
      .http()
      .patch(url(s, `/members/${s.resident.membershipId}`))
      .set(auth(s.admin))
      .send({ roleIds: [created.body.id] });
    const inUse = await h
      .http()
      .delete(url(s, `/roles/${created.body.id}`))
      .set(auth(s.admin));
    expect(inUse.status).toBe(409);
    expect(inUse.body.code).toBe('ROLE_IN_USE');

    // The member gets the permission at once, without signing in again.
    const slots = await h
      .http()
      .post(url(s, '/parking/slots'))
      .set(auth(s.resident.token))
      .send({ slots: [{ code: 'P-99' }] });
    expect(slots.status).toBe(201);

    await h
      .http()
      .patch(url(s, `/members/${s.resident.membershipId}`))
      .set(auth(s.admin))
      .send({ roleIds: [resident?.id] });
    const gone = await h
      .http()
      .delete(url(s, `/roles/${created.body.id}`))
      .set(auth(s.admin));
    expect(gone.status).toBe(200);
    expect((await roles(s)).map((r) => r.name)).not.toContain('Security');
  });

  it('never lets anyone give a permission they do not hold', async () => {
    const s = await societyWithResident(h, 'r2');
    const helper = await h
      .http()
      .post(url(s, '/roles'))
      .set(auth(s.admin))
      .send({ name: 'Role helper', permissions: ['society.roles.manage', 'notice.publish'] });
    await h
      .http()
      .patch(url(s, `/members/${s.resident.membershipId}`))
      .set(auth(s.admin))
      .send({ roleIds: [helper.body.id] });

    const token = s.resident.token;
    const tooMuch = await h
      .http()
      .post(url(s, '/roles'))
      .set(auth(token))
      .send({ name: 'Money', permissions: ['maintenance.record_payment'] });
    expect(tooMuch.status).toBe(403);
    const fine = await h
      .http()
      .post(url(s, '/roles'))
      .set(auth(token))
      .send({ name: 'Notice writer', permissions: ['notice.publish'] });
    expect(fine.status).toBe(201);

    const treasurer = (await roles(s)).find((r) => r.key === 'treasurer');
    const strip = await h
      .http()
      .patch(url(s, `/roles/${treasurer?.id}`))
      .set(auth(token))
      .send({ permissions: [] });
    expect(strip.status).toBe(403);

    const resident = await h.http().get(url(s, '/roles')).set(auth(token));
    expect(resident.status).toBe(200);
  });

  it('keeps roles inside their society', async () => {
    const a = await societyWithResident(h, 'r3a');
    const b = await societyWithResident(h, 'r3b');
    const roleB = (await roles(b)).find((r) => r.key === 'committee');
    const cross = await h
      .http()
      .patch(url(a, `/roles/${roleB?.id}`))
      .set(auth(a.admin))
      .send({ name: 'Hijack' });
    expect(cross.status).toBe(404);
    const del = await h
      .http()
      .delete(url(a, `/roles/${roleB?.id}`))
      .set(auth(a.admin));
    expect(del.status).toBe(404);
  });
});

describe('audit log', () => {
  it('lists what happened, by area, with who did it, for permitted members only', async () => {
    const s = await societyWithResident(h, 'a1');
    await h
      .http()
      .post(url(s, '/notices'))
      .set(auth(s.admin))
      .send({ title: 'Water cut on Sunday', body: 'From 10 to 2.' });
    await h
      .http()
      .post(url(s, '/roles'))
      .set(auth(s.admin))
      .send({ name: 'Gardener', permissions: [] });

    const all = await h.http().get(url(s, '/audit?limit=50')).set(auth(s.admin));
    expect(all.status).toBe(200);
    const actions = all.body.items.map((e: { action: string }) => e.action);
    expect(actions[0]).toBe('role.created');
    expect(actions).toEqual(
      expect.arrayContaining(['notice.published', 'invitation.created', 'flat.created']),
    );
    expect(all.body.items[0].actor).toMatchObject({ displayName: expect.any(String) });

    const notices = await h.http().get(url(s, '/audit?area=notices')).set(auth(s.admin));
    expect(notices.body.items.map((e: { action: string }) => e.action)).toEqual([
      'notice.published',
    ]);

    const pageOne = await h.http().get(url(s, '/audit?limit=2')).set(auth(s.admin));
    expect(pageOne.body.items).toHaveLength(2);
    const pageTwo = await h
      .http()
      .get(url(s, `/audit?limit=2&cursor=${pageOne.body.nextCursor}`))
      .set(auth(s.admin));
    expect(pageTwo.body.items[0].id).not.toBe(pageOne.body.items[1].id);
    expect(pageTwo.body.items[0].id).toBe(all.body.items[2].id);

    const denied = await h.http().get(url(s, '/audit')).set(auth(s.resident.token));
    expect(denied.status).toBe(403);

    const other = await societyWithResident(h, 'a2');
    const theirs = await h.http().get(url(other, '/audit?limit=50')).set(auth(other.admin));
    expect(theirs.body.items.some((e: { action: string }) => e.action === 'notice.published')).toBe(
      false,
    );
  });
});
