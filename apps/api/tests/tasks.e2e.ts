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

async function task(s: SocietyFixture, body: Record<string, unknown> = {}) {
  const res = await h
    .http()
    .post(url(s, '/tasks'))
    .set(auth(s.admin))
    .send({ title: 'Submit water bill at PMC', points: 3, ...body });
  if (res.status !== 201) throw new Error(`task: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

const act = (s: SocietyFixture, token: string, id: string, action: string, body?: object) =>
  h
    .http()
    .post(url(s, `/tasks/${id}/${action}`))
    .set(auth(token))
    .send(body ?? {});

async function notes(token: string) {
  const res = await h.http().get('/v1/me/notifications?limit=50').set(auth(token));
  return res.body.items as { title: string; body: string }[];
}

const setModule = (s: SocietyFixture, key: string, settings: Record<string, unknown>) =>
  h
    .http()
    .patch(url(s, `/modules/${key}`))
    .set(auth(s.admin))
    .send({ settings });

describe('tasks and rewards', () => {
  it('a member volunteers, marks it done, the committee accepts it and points arrive', async () => {
    const s = await societyWithResident(h, 't1');
    const byResident = await h
      .http()
      .post(url(s, '/tasks'))
      .set(auth(s.resident.token))
      .send({ title: 'Mine' });
    expect(byResident.status).toBe(403);

    const t = await task(s, { description: 'Before the 15th', dueOn: '2030-01-15' });
    expect(t).toMatchObject({ status: 'OPEN', assignee: null, canManage: true });
    const open = await h.http().get(url(s, '/tasks?view=OPEN')).set(auth(s.resident.token));
    expect(open.body.map((x: { id: string }) => x.id)).toEqual([t.id]);

    const took = await act(s, s.resident.token, t.id, 'volunteer');
    expect(took.status).toBe(201);
    expect(took.body).toMatchObject({
      status: 'IN_PROGRESS',
      assignee: { displayName: 'Resident t1' },
      canSubmit: true,
      canWithdraw: true,
    });
    expect((await act(s, s.admin, t.id, 'volunteer')).status).toBe(409);

    const home = await h.http().get(url(s, '/home')).set(auth(s.resident.token));
    expect(home.body.attention).toContainEqual(
      expect.objectContaining({ type: 'MY_TASK', taskId: t.id, returned: false }),
    );
    expect(home.body.contribution).toEqual({ points: 0, openTasks: 1 });

    const done = await act(s, s.resident.token, t.id, 'submit', { note: 'Paid at counter 3' });
    expect(done.body).toMatchObject({ status: 'SUBMITTED', submissionNote: 'Paid at counter 3' });
    expect((await notes(s.admin)).map((n) => n.title)).toContain(
      'Check task: Submit water bill at PMC',
    );
    const adminHome = await h.http().get(url(s, '/home')).set(auth(s.admin));
    expect(adminHome.body.attention).toContainEqual({ type: 'TASKS_TO_VERIFY', count: 1 });
    expect((await act(s, s.resident.token, t.id, 'verify')).status).toBe(403);

    const accepted = await act(s, s.admin, t.id, 'verify');
    expect(accepted.body.status).toBe('COMPLETED');
    expect(accepted.body.events.map((e: { kind: string }) => e.kind)).toEqual([
      'VERIFIED',
      'SUBMITTED',
      'VOLUNTEERED',
      'CREATED',
    ]);
    expect((await notes(s.resident.token))[0]).toMatchObject({
      title: 'Task done: Submit water bill at PMC',
      body: '+3 points',
    });
    const points = await h.http().get(url(s, '/rewards/me')).set(auth(s.resident.token));
    expect(points.body).toMatchObject({
      points: 3,
      allTimePoints: 3,
      rank: null,
      entries: [
        expect.objectContaining({ delta: 3, reason: 'TASK', label: 'Submit water bill at PMC' }),
      ],
    });
    const after = await h.http().get(url(s, '/home')).set(auth(s.resident.token));
    expect(after.body.contribution).toEqual({ points: 3, openTasks: 0 });
    expect((await act(s, s.admin, t.id, 'cancel')).status).toBe(409);
  });

  it('assigns, sends work back, gives it back and cancels', async () => {
    const s = await societyWithResident(h, 't2');
    const t = await task(s, { assigneeMembershipId: s.resident.membershipId });
    expect(t.status).toBe('IN_PROGRESS');
    expect((await notes(s.resident.token)).map((n) => n.title)).toContain(
      'New task: Submit water bill at PMC',
    );
    await act(s, s.resident.token, t.id, 'submit');
    const back = await act(s, s.admin, t.id, 'return', { reason: 'Receipt photo missing' });
    expect(back.body.status).toBe('IN_PROGRESS');
    expect((await notes(s.resident.token))[0]).toMatchObject({
      title: 'Task sent back: Submit water bill at PMC',
      body: 'Receipt photo missing',
    });
    const home = await h.http().get(url(s, '/home')).set(auth(s.resident.token));
    expect(home.body.attention).toContainEqual(
      expect.objectContaining({ type: 'MY_TASK', returned: true }),
    );

    const gaveBack = await act(s, s.resident.token, t.id, 'withdraw');
    expect(gaveBack.body).toMatchObject({ status: 'OPEN', assignee: null });
    expect((await act(s, s.resident.token, t.id, 'submit')).status).toBe(403);

    const edited = await h
      .http()
      .patch(url(s, `/tasks/${t.id}`))
      .set(auth(s.admin))
      .send({ points: 5, title: 'Submit bill' });
    expect(edited.body).toMatchObject({ points: 5, title: 'Submit bill' });
    const cancelled = await act(s, s.admin, t.id, 'cancel');
    expect(cancelled.body.status).toBe('CANCELLED');
  });

  it('never lets someone accept their own work; caps monthly points; adjusts and ranks', async () => {
    const s = await societyWithResident(h, 't3');
    const roles = await h.http().get(url(s, '/roles')).set(auth(s.admin));
    const committee = roles.body.find((r: { key: string }) => r.key === 'committee');
    await h
      .http()
      .patch(url(s, `/members/${s.resident.membershipId}`))
      .set(auth(s.admin))
      .send({ roleIds: [committee.id] });
    const own = await task(s, { assigneeMembershipId: s.resident.membershipId });
    await act(s, s.resident.token, own.id, 'submit');
    const list = await h.http().get(url(s, '/tasks?view=TO_VERIFY')).set(auth(s.resident.token));
    expect(list.body).toHaveLength(0);
    expect((await act(s, s.resident.token, own.id, 'verify')).status).toBe(403);

    await setModule(s, 'rewards', { maxPointsPerMonth: 5 });
    await act(s, s.admin, own.id, 'verify');
    const second = await task(s, { assigneeMembershipId: s.resident.membershipId });
    await act(s, s.resident.token, second.id, 'submit');
    await act(s, s.admin, second.id, 'verify');
    let mine = await h.http().get(url(s, '/rewards/me')).set(auth(s.resident.token));
    expect(mine.body.points).toBe(5);

    const adjust = await h
      .http()
      .post(url(s, '/rewards/adjustments'))
      .set(auth(s.admin))
      .send({ membershipId: s.resident.membershipId, delta: -1, note: 'Double count' });
    expect(adjust.body.points).toBe(4);
    const byResident = await h
      .http()
      .post(url(s, '/rewards/adjustments'))
      .set(auth(s.resident.token))
      .send({ membershipId: s.resident.membershipId, delta: 10, note: 'Me' });
    expect(byResident.status).toBe(403);

    expect(
      (await h.http().get(url(s, '/rewards/leaderboard')).set(auth(s.resident.token))).status,
    ).toBe(403);
    await setModule(s, 'rewards', { leaderboard: 'TOP_5', maxPointsPerMonth: 5 });
    const board = await h.http().get(url(s, '/rewards/leaderboard')).set(auth(s.resident.token));
    expect(board.body.rows).toEqual([
      expect.objectContaining({ rank: 1, displayName: 'Resident t3', flat: '101', points: 4 }),
    ]);
    mine = await h.http().get(url(s, '/rewards/me')).set(auth(s.resident.token));
    expect(mine.body.rank).toBe(1);
  });

  it('respects the volunteering setting and never leaks across societies', async () => {
    const a = await societyWithResident(h, 't4');
    const b = await societyWithResident(h, 't5');
    const t = await task(a);
    await setModule(a, 'tasks', { volunteeringEnabled: false });
    const res = await act(a, a.resident.token, t.id, 'volunteer');
    expect(res.status).toBe(403);
    expect(
      (
        await h
          .http()
          .get(url(b, `/tasks/${t.id}`))
          .set(auth(b.admin))
      ).status,
    ).toBe(404);
    expect((await act(b, b.resident.token, t.id, 'volunteer')).status).toBe(404);
    const assignAcross = await h
      .http()
      .post(url(b, '/tasks'))
      .set(auth(b.admin))
      .send({ title: 'Cross', assigneeMembershipId: a.resident.membershipId });
    expect(assignAcross.status).toBe(404);
    const adjustAcross = await h
      .http()
      .post(url(b, '/rewards/adjustments'))
      .set(auth(b.admin))
      .send({ membershipId: a.resident.membershipId, delta: 5, note: 'Cross' });
    expect(adjustAcross.status).toBe(404);
  });
});
