import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { todayIn } from '../src/common/util/dates';
import { addMember, auth, type SocietyFixture, societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const url = (s: { societyId: string }, rest = '') => `/v1/societies/${s.societyId}${rest}`;
const leave = (s: { societyId: string }, token: string) =>
  h.http().post(url(s, '/members/me/leave')).set(auth(token)).send({});

async function post(token: string, path: string, body: Record<string, unknown>) {
  const res = await h.http().post(path).set(auth(token)).send(body);
  if (res.status !== 201) throw new Error(`${path}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

async function giveWork(s: SocietyFixture) {
  const task = await post(s.admin, url(s, '/tasks'), {
    title: 'Fix the gate',
    assigneeMembershipId: s.resident.membershipId,
  });
  const duty = await post(s.admin, url(s, '/duties'), {
    title: 'Garden watering',
    participantKind: 'MEMBER',
    participantIds: [s.resident.membershipId, s.adminMembershipId],
    periodUnit: 'WEEK',
    startDate: todayIn('Asia/Kolkata'),
  });
  return { task, duty };
}

describe('leave a society', () => {
  it('ends my membership and flats, hands back my tasks and duty turns, writes an audit row', async () => {
    const s = await societyWithResident(h, 'lv-a');
    const r = s.resident;
    const work = await giveWork(s);
    expect(work.duty.current.participant.id).toBe(r.membershipId);

    const res = await leave(s, r.token);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });

    const m = await h.prisma.membership.findUniqueOrThrow({ where: { id: r.membershipId } });
    expect(m.status).toBe('LEFT');
    expect(m.leftAt).not.toBeNull();
    const openFlats = await h.prisma.flatOccupancy.count({
      where: { membershipId: r.membershipId, toDate: null },
    });
    expect(openFlats).toBe(0);
    const audit = await h.prisma.auditLog.findFirst({
      where: { action: 'member.left', entityId: r.membershipId },
    });
    expect(audit?.societyId).toBe(s.societyId);

    // Task back on the open list; the duty runs without them.
    const task = await h.prisma.task.findUniqueOrThrow({ where: { id: work.task.id } });
    expect([task.status, task.assigneeMembershipId]).toEqual(['OPEN', null]);
    const duty = await h
      .http()
      .get(url(s, `/duties/${work.duty.id}`))
      .set(auth(s.admin));
    expect(duty.body.participants.map((p: { id: string }) => p.id)).toEqual([s.adminMembershipId]);
    expect(duty.body.current).toMatchObject({ status: 'SKIPPED', overrideNote: 'Member left' });

    // The society is closed to them now, and their context has no active membership in it.
    expect((await h.http().get(url(s, '/notices')).set(auth(r.token))).status).toBe(404);
    const ctx = await h.http().get('/v1/me/context').set(auth(r.token));
    expect(
      ctx.body.memberships.some(
        (x: { society: { id: string }; status: string }) =>
          x.society.id === s.societyId && x.status === 'ACTIVE',
      ),
    ).toBe(false);
    expect((await leave(s, r.token)).status).toBe(404);
  });

  it('refuses the last admin with LAST_ADMIN; with a second admin the first may leave', async () => {
    const s = await societyWithResident(h, 'lv-b');
    const alone = await leave(s, s.admin);
    expect(alone.status).toBe(409);
    expect(alone.body.code).toBe('LAST_ADMIN');
    const still = await h.prisma.membership.findUniqueOrThrow({
      where: { id: s.adminMembershipId },
    });
    expect(still.status).toBe('ACTIVE');

    const second = await addMember(h, s, 'lv-b-admin', 'admin');
    expect((await leave(s, s.admin)).status).toBe(201);
    // Now the second admin is the only one left.
    const last = await leave(s, second.token);
    expect(last.status).toBe(409);
    expect(last.body.code).toBe('LAST_ADMIN');
  });

  it('cannot leave a society I am not in, and leaving one leaves my other society alone', async () => {
    const a = await societyWithResident(h, 'lv-c');
    const b = await societyWithResident(h, 'lv-d');
    const r = a.resident;

    // Not a member of B yet: B is invisible by id, nothing changes anywhere.
    const trick = await leave(b, r.token);
    expect(trick.status).toBe(404);
    expect(
      (await h.prisma.membership.findUniqueOrThrow({ where: { id: r.membershipId } })).status,
    ).toBe('ACTIVE');

    // The same person joins B and gets a task there; leaving A touches nothing in B.
    const invite = await post(b.admin, url(b, '/invitations'), {
      inviteeName: 'Resident A',
      flatId: b.flats[1]?.id,
    });
    await post(r.token, '/v1/join/invite', { code: invite.code });
    const ctx = await h.http().get('/v1/me/context').set(auth(r.token));
    const inB = ctx.body.memberships.find(
      (m: { society: { id: string } }) => m.society.id === b.societyId,
    ).id as string;
    const taskB = await post(b.admin, url(b, '/tasks'), {
      title: 'Paint the railing',
      assigneeMembershipId: inB,
    });

    expect((await leave(a, r.token)).status).toBe(201);
    const mB = await h.prisma.membership.findUniqueOrThrow({ where: { id: inB } });
    expect(mB.status).toBe('ACTIVE');
    expect(await h.prisma.flatOccupancy.count({ where: { membershipId: inB, toDate: null } })).toBe(
      1,
    );
    const stillB = await h.prisma.task.findUniqueOrThrow({ where: { id: taskB.id } });
    expect(stillB.assigneeMembershipId).toBe(inB);
    expect((await h.http().get(url(b, '/notices')).set(auth(r.token))).status).toBe(200);
  });
});
