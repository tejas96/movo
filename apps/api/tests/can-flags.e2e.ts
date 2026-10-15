import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { todayIn } from '../src/common/util/dates';
import { newId } from '../src/common/util/ids';
import { addMember, auth, type SocietyFixture, societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

/**
 * The can* flags on entities follow the same rules as the routes they stand for: an admin, the
 * author, another committee member and a plain resident each get the buttons they may use.
 */
let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const url = (s: SocietyFixture, rest = '') => `/v1/societies/${s.societyId}${rest}`;
const HOUR = 3_600_000;

async function get(token: string, path: string) {
  const res = await h.http().get(path).set(auth(token));
  if (res.status !== 200) throw new Error(`${path}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

async function post(token: string, path: string, body: Record<string, unknown> = {}) {
  const res = await h.http().post(path).set(auth(token)).send(body);
  if (res.status !== 201) throw new Error(`${path}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

/** Admin, a committee member who writes things (author), another committee member, a resident. */
async function people(tag: string) {
  const s = await societyWithResident(h, tag);
  const author = await addMember(h, s, `${tag}-author`, 'committee');
  const other = await addMember(h, s, `${tag}-other`, 'committee');
  return { s, admin: s.admin, author: author.token, other: other.token, resident: s.resident };
}

const pick = (body: Record<string, unknown>, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, body[k]]));

describe('can* flags', () => {
  it('notices: admin and author may edit, another publisher and a resident may not', async () => {
    const { s, admin, author, other, resident } = await people('cf-n');
    const n = await post(author, url(s, '/notices'), { title: 'Lift service', body: 'Sunday' });
    const path = url(s, `/notices/${n.id}`);

    expect((await get(admin, path)).canEdit).toBe(true);
    expect((await get(author, path)).canEdit).toBe(true);
    expect((await get(other, path)).canEdit).toBe(false);
    expect((await get(resident.token, path)).canEdit).toBe(false);

    // The flag and the route agree.
    const byOther = await h.http().patch(path).set(auth(other)).send({ title: 'Changed' });
    expect(byOther.status).toBe(403);
    const byAuthor = await h.http().patch(path).set(auth(author)).send({ title: 'Lift check' });
    expect(byAuthor.status).toBe(200);
    expect(byAuthor.body.canEdit).toBe(true);
  });

  it('tasks: manager, assignee and checker each see their own actions', async () => {
    const { s, admin, author, resident } = await people('cf-t');
    const t = await post(author, url(s, '/tasks'), {
      title: 'Clean the tank',
      assigneeMembershipId: resident.membershipId,
    });
    const path = url(s, `/tasks/${t.id}`);
    const keys = ['canManage', 'canSubmit', 'canWithdraw', 'canVerify', 'canVolunteer'];

    expect(pick(await get(admin, path), keys)).toEqual({
      canManage: true,
      canSubmit: false,
      canWithdraw: false,
      canVerify: false,
      canVolunteer: false,
    });
    expect(pick(await get(author, path), keys)).toMatchObject({
      canManage: true,
      canSubmit: false,
    });
    expect(pick(await get(resident.token, path), keys)).toEqual({
      canManage: false,
      canSubmit: true,
      canWithdraw: true,
      canVerify: false,
      canVolunteer: false,
    });

    await post(resident.token, url(s, `/tasks/${t.id}/submit`), { note: 'Done' });
    expect((await get(admin, path)).canVerify).toBe(true);
    expect((await get(author, path)).canVerify).toBe(true);
    expect(pick(await get(resident.token, path), keys)).toMatchObject({
      canVerify: false,
      canSubmit: false,
      canWithdraw: false,
    });
  });

  it('expenses: approver decides, author edits their own, a resident only reads', async () => {
    const { s, admin, author, resident } = await people('cf-x');
    await h
      .http()
      .patch(url(s, '/modules/expenses'))
      .set(auth(admin))
      .send({ settings: { visibleToMembers: 'DETAILED', approval: 'ALWAYS' } });
    const categories = await get(admin, url(s, '/expenses/categories'));
    const e = await post(author, url(s, '/expenses'), {
      categoryId: categories[0].id,
      amountPaise: 250_000,
      incurredOn: todayIn('Asia/Kolkata'),
      payeeName: 'Plumber',
      method: 'CASH',
      idempotencyKey: newId(),
    });
    expect(e.status).toBe('PENDING');
    const path = url(s, `/expenses/${e.id}`);
    const keys = ['canDecide', 'canEdit', 'canRemove', 'isMine'];

    expect(pick(await get(admin, path), keys)).toEqual({
      canDecide: true,
      canEdit: true,
      canRemove: true,
      isMine: false,
    });
    expect(pick(await get(author, path), keys)).toEqual({
      canDecide: false,
      canEdit: true,
      canRemove: true,
      isMine: true,
    });
    // Members see approved expenses only.
    expect((await h.http().get(path).set(auth(resident.token))).status).toBe(404);

    await post(admin, url(s, `/expenses/${e.id}/approve`));
    const allFalse = { canDecide: false, canEdit: false, canRemove: false };
    expect(pick(await get(admin, path), keys)).toEqual({ ...allFalse, isMine: false });
    expect(pick(await get(author, path), keys)).toEqual({ ...allFalse, isMine: true });
    expect(pick(await get(resident.token, path), keys)).toEqual({ ...allFalse, isMine: false });
  });

  it('meetings: managers change a scheduled meeting and complete it once it started', async () => {
    const { s, admin, author, resident } = await people('cf-m');
    const m = await post(author, url(s, '/meetings'), {
      title: 'AGM',
      startsAt: new Date(Date.now() + 48 * HOUR).toISOString(),
    });
    const path = url(s, `/meetings/${m.id}`);
    const keys = ['canManage', 'canComplete'];

    expect(pick(await get(admin, path), keys)).toEqual({ canManage: true, canComplete: false });
    expect(pick(await get(author, path), keys)).toEqual({ canManage: true, canComplete: false });
    expect(pick(await get(resident.token, path), keys)).toEqual({
      canManage: false,
      canComplete: false,
    });

    await h.prisma.meeting.update({
      where: { id: m.id },
      data: { startsAt: new Date(Date.now() - HOUR) },
    });
    expect(pick(await get(admin, path), keys)).toEqual({ canManage: true, canComplete: true });
    expect(pick(await get(resident.token, path), keys)).toEqual({
      canManage: false,
      canComplete: false,
    });

    await post(admin, url(s, `/meetings/${m.id}/cancel`));
    expect(pick(await get(admin, path), keys)).toEqual({ canManage: false, canComplete: false });
  });

  it('members and roles: admins manage others, not themselves; built-in roles stay', async () => {
    const { s, admin, resident } = await people('cf-r');
    expect((await get(admin, url(s, `/members/${resident.membershipId}`))).canManage).toBe(true);
    expect((await get(admin, url(s, `/members/${s.adminMembershipId}`))).canManage).toBe(false);
    expect((await get(resident.token, url(s, `/members/${s.adminMembershipId}`))).canManage).toBe(
      false,
    );

    const custom = await post(admin, url(s, '/roles'), { name: 'Gardeners', permissions: [] });
    const roles = await get(admin, url(s, '/roles'));
    const flags = (key: string) => {
      const r = roles.find((x: { key: string }) => x.key === key);
      return { canEditPermissions: r.canEditPermissions, canDelete: r.canDelete };
    };
    expect(flags('admin')).toEqual({ canEditPermissions: false, canDelete: false });
    expect(flags('committee')).toEqual({ canEditPermissions: true, canDelete: false });
    expect(flags(custom.key)).toEqual({ canEditPermissions: true, canDelete: true });
    const asResident = await get(resident.token, url(s, '/roles'));
    expect(
      asResident.every(
        (r: { canEditPermissions: boolean; canDelete: boolean }) =>
          !r.canEditPermissions && !r.canDelete,
      ),
    ).toBe(true);
  });
});
