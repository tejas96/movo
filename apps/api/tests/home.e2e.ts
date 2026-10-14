import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { todayIn } from '../src/common/util/dates';
import { auth, type SocietyFixture, societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const HOUR = 3_600_000;
const inHours = (n: number) => new Date(Date.now() + n * HOUR).toISOString();
const MONTH_START = `${todayIn('Asia/Kolkata').slice(0, 7)}-01`;
const url = (s: SocietyFixture, rest = '') => `/v1/societies/${s.societyId}${rest}`;

async function post(s: SocietyFixture, token: string, path: string, body: object) {
  const res = await h.http().post(url(s, path)).set(auth(token)).send(body);
  if (res.status !== 201) throw new Error(`${path}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

describe('home', () => {
  it('puts every module part in the fixed order', async () => {
    const s = await societyWithResident(h, 'hm1');
    const first = await post(s, s.admin, '/notices', {
      title: 'Water off tomorrow',
      body: '10 AM to 2 PM',
      category: 'WATER',
      priority: 'IMPORTANT',
    });
    const second = await post(s, s.admin, '/notices', {
      title: 'Lift service',
      body: 'Lift B off on Sunday',
      priority: 'IMPORTANT',
    });
    const duty = await post(s, s.admin, '/duties', {
      title: 'Main gate locking',
      participantIds: s.flats.map((f) => f.id),
      periodUnit: 'MONTH',
      startDate: MONTH_START,
    });
    const task = await post(s, s.admin, '/tasks', {
      title: 'Submit water bill at PMC',
      assigneeMembershipId: s.resident.membershipId,
    });
    const meeting = await post(s, s.admin, '/meetings', {
      title: 'Committee meeting',
      startsAt: inHours(48),
    });
    const event = await post(s, s.admin, '/events', { title: 'Diwali', startsAt: inHours(24) });
    await post(s, s.admin, '/events', { title: 'Holi', startsAt: inHours(72) });
    await post(s, s.admin, '/invitations', { inviteeName: 'Guest', flatId: s.flats[1]?.id });
    const alert = await post(s, s.resident.token, '/emergency/alerts', {
      type: 'FIRE',
      message: 'Smoke near lift room',
    });

    const resident = await h.http().get(url(s, '/home')).set(auth(s.resident.token));
    expect(resident.status).toBe(200);
    expect(resident.body.attention).toEqual([
      expect.objectContaining({ type: 'ACTIVE_ALERT', alertId: alert.id }),
      expect.objectContaining({ type: 'IMPORTANT_NOTICE', noticeId: first.id }),
      expect.objectContaining({ type: 'IMPORTANT_NOTICE', noticeId: second.id }),
      expect.objectContaining({ type: 'MY_DUTY', dutyId: duty.id }),
      expect.objectContaining({ type: 'MY_TASK', taskId: task.id }),
    ]);
    expect(resident.body.upcoming.map((u: { id: string; kind: string }) => [u.kind, u.id])).toEqual(
      [
        ['EVENT', event.id],
        ['MEETING', meeting.id],
      ],
    );
    expect(resident.body.notices.map((n: { id: string }) => n.id)).toEqual([second.id, first.id]);
    expect(resident.body.contribution).toEqual({ points: 0, openTasks: 1 });
    expect(resident.body.flats).toEqual([expect.objectContaining({ number: '101' })]);

    const admin = await h.http().get(url(s, '/home')).set(auth(s.admin));
    expect(admin.body.attention.map((a: { type: string }) => a.type)).toEqual([
      'ACTIVE_ALERT',
      'IMPORTANT_NOTICE',
      'IMPORTANT_NOTICE',
      'INVITATIONS_PENDING',
    ]);
    expect(admin.body.contribution).toBeNull();
  });
});
