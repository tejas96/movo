import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DutiesService } from '../src/modules/duties/duties.service';
import { addDays, todayIn } from '../src/modules/maintenance/billing';
import { auth, type SocietyFixture, societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const TODAY = todayIn('Asia/Kolkata');
const MONTH_START = `${TODAY.slice(0, 7)}-01`;
/** 06:00 IST on a calendar date. */
const at = (date: string) => new Date(`${date}T00:30:00Z`);
const url = (s: SocietyFixture, rest = '') => `/v1/societies/${s.societyId}/duties${rest}`;

function nextMonthStart(date: string): string {
  const [y, m] = date.split('-').map(Number) as [number, number];
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
}

async function createDuty(s: SocietyFixture, body: Record<string, unknown> = {}) {
  const res = await h
    .http()
    .post(url(s))
    .set(auth(s.admin))
    .send({
      title: 'Main gate locking',
      participantIds: s.flats.map((f) => f.id),
      periodUnit: 'MONTH',
      startDate: MONTH_START,
      ...body,
    });
  if (res.status !== 201) throw new Error(`duty: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

async function titles(token: string): Promise<string[]> {
  const res = await h.http().get('/v1/me/notifications?limit=50').set(auth(token));
  return res.body.items.map((n: { title: string }) => n.title);
}

describe('duties', () => {
  it('plans a monthly rotation, tells the flat, shows on Home and lets them mark it done', async () => {
    const s = await societyWithResident(h, 'd1');
    const byResident = await h
      .http()
      .post(url(s))
      .set(auth(s.resident.token))
      .send({ title: 'Mine', participantIds: [s.flats[0]?.id], startDate: MONTH_START });
    expect(byResident.status).toBe(403);

    const duty = await createDuty(s);
    expect(duty).toMatchObject({
      status: 'ACTIVE',
      requiresConfirmation: true,
      current: {
        participant: { label: '101' },
        status: 'ACTIVE',
        periodStart: MONTH_START,
        mine: false,
      },
      next: { participant: { label: '102' }, status: 'UPCOMING' },
    });
    expect(duty.participants.map((p: { label: string }) => p.label)).toEqual(['101', '102']);
    expect(duty.upcoming).toHaveLength(6);
    expect(
      await h.prisma.responsibilityAssignment.count({ where: { responsibilityId: duty.id } }),
    ).toBe(12);
    expect(await titles(s.resident.token)).toContain('Your turn: Main gate locking');

    const home = await h
      .http()
      .get(`/v1/societies/${s.societyId}/home`)
      .set(auth(s.resident.token));
    expect(home.body.attention).toContainEqual(
      expect.objectContaining({ type: 'MY_DUTY', dutyId: duty.id, canConfirm: true }),
    );
    const mine = await h.http().get(url(s, '?mine=true')).set(auth(s.resident.token));
    expect(mine.body.map((d: { id: string }) => d.id)).toEqual([duty.id]);
    expect(mine.body[0].current.mine).toBe(true);

    const done = await h
      .http()
      .post(url(s, `/${duty.id}/assignments/${duty.current.id}/confirm`))
      .set(auth(s.resident.token));
    expect(done.status).toBe(201);
    expect(done.body.current).toMatchObject({
      status: 'COMPLETED',
      confirmedBy: { displayName: 'Resident d1' },
    });
    expect(done.body.history).toHaveLength(0);
    const again = await h
      .http()
      .post(url(s, `/${duty.id}/assignments/${duty.current.id}/confirm`))
      .set(auth(s.resident.token));
    expect(again.status).toBe(409);

    // The next turn is flat 102's: the resident of 101 cannot mark it done.
    const next = await h
      .http()
      .get(url(s, `/${duty.id}`))
      .set(auth(s.admin));
    const service = h.app.get(DutiesService);
    await service.advance(at(nextMonthStart(TODAY)));
    const moved = await h
      .http()
      .get(url(s, `/${duty.id}`))
      .set(auth(s.resident.token));
    expect(moved.body.current).toMatchObject({
      id: next.body.next.id,
      participant: { label: '102' },
    });
    const notMine = await h
      .http()
      .post(url(s, `/${duty.id}/assignments/${moved.body.current.id}/confirm`))
      .set(auth(s.resident.token));
    expect(notMine.status).toBe(403);
  });

  it('marks unconfirmed turns missed, carries them over when asked, and reminds before the end', async () => {
    const s = await societyWithResident(h, 'd2');
    const service = h.app.get(DutiesService);
    const plain = await createDuty(s, { title: 'Tank cleaning' });
    const carry = await createDuty(s, { title: 'Terrace check', onMiss: 'CARRY_OVER' });
    const monthEnd = addDays(nextMonthStart(TODAY), -1);

    await service.advance(at(addDays(monthEnd, -2)));
    await service.advance(at(addDays(monthEnd, -1)));
    expect((await titles(s.resident.token)).filter((t) => t.startsWith('Mark done:'))).toHaveLength(
      2,
    );

    await service.advance(at(nextMonthStart(TODAY)));
    const p = (
      await h
        .http()
        .get(url(s, `/${plain.id}`))
        .set(auth(s.admin))
    ).body;
    expect(p.history[0]).toMatchObject({ status: 'MISSED', participant: { label: '101' } });
    expect(p.current.participant.label).toBe('102');
    const c = (
      await h
        .http()
        .get(url(s, `/${carry.id}`))
        .set(auth(s.admin))
    ).body;
    expect(c.history[0]).toMatchObject({ status: 'MISSED', participant: { label: '101' } });
    expect(c.current.participant.label).toBe('101');
    expect(c.next.participant.label).toBe('102');
    expect(await titles(s.resident.token)).toContain('Missed: Terrace check');

    // A missed turn can still be marked done by the committee.
    const fixed = await h
      .http()
      .post(url(s, `/${plain.id}/assignments/${p.history[0].id}/override`))
      .set(auth(s.admin))
      .send({ action: 'COMPLETE', reason: 'Done late, checked by guard' });
    expect(fixed.body.history[0]).toMatchObject({
      status: 'COMPLETED',
      overrideNote: 'Done late, checked by guard',
    });
  });

  it('skips or reassigns turns, replans when the order changes, and pauses or ends', async () => {
    const s = await societyWithResident(h, 'd3');
    const flat103 = await h
      .http()
      .post(`/v1/societies/${s.societyId}/flats`)
      .set(auth(s.admin))
      .send({ flats: [{ number: '103' }] });
    const f103 = flat103.body[0].id;
    const duty = await createDuty(s);

    const reordered = await h
      .http()
      .put(url(s, `/${duty.id}/participants`))
      .set(auth(s.admin))
      .send({ participantIds: [s.flats[0]?.id, s.flats[1]?.id, f103] });
    expect(reordered.body.current.participant.label).toBe('101');
    expect(
      reordered.body.upcoming
        .slice(0, 3)
        .map((a: { participant: { label: string } }) => a.participant.label),
    ).toEqual(['102', '103', '101']);

    const skipped = await h
      .http()
      .post(url(s, `/${duty.id}/assignments/${reordered.body.next.id}/override`))
      .set(auth(s.admin))
      .send({ action: 'SKIP', reason: 'Festival month' });
    expect(skipped.body.next.participant.label).toBe('103');

    const given = await h
      .http()
      .post(url(s, `/${duty.id}/assignments/${duty.current.id}/override`))
      .set(auth(s.admin))
      .send({ action: 'REASSIGN', participantId: f103, reason: '101 is away' });
    expect(given.body.current).toMatchObject({
      participant: { label: '103' },
      overrideNote: '101 is away',
    });
    const outsider = await h
      .http()
      .post(url(s, `/${duty.id}/assignments/${duty.current.id}/override`))
      .set(auth(s.admin))
      .send({ action: 'REASSIGN', participantId: s.resident.membershipId, reason: 'Wrong kind' });
    expect(outsider.status).toBe(400);
    const byResident = await h
      .http()
      .post(url(s, `/${duty.id}/assignments/${duty.current.id}/override`))
      .set(auth(s.resident.token))
      .send({ action: 'SKIP', reason: 'Not today' });
    expect(byResident.status).toBe(403);

    const paused = await h
      .http()
      .post(url(s, `/${duty.id}/status`))
      .set(auth(s.admin))
      .send({ status: 'PAUSED' });
    expect(paused.body).toMatchObject({ status: 'PAUSED', next: null, upcoming: [] });
    const resumed = await h
      .http()
      .post(url(s, `/${duty.id}/status`))
      .set(auth(s.admin))
      .send({ status: 'ACTIVE' });
    expect(resumed.body.upcoming.length).toBeGreaterThan(0);
    const ended = await h
      .http()
      .post(url(s, `/${duty.id}/status`))
      .set(auth(s.admin))
      .send({ status: 'ENDED' });
    expect(ended.body).toMatchObject({ status: 'ENDED', current: null });
    expect((await h.http().get(url(s)).set(auth(s.admin))).body).toHaveLength(0);
  });

  it('rotates members weekly and gives points when the society allows it', async () => {
    const s = await societyWithResident(h, 'd4');
    await h
      .http()
      .patch(`/v1/societies/${s.societyId}/modules/rewards`)
      .set(auth(s.admin))
      .send({ settings: { dutiesEarnPoints: true } });
    const duty = await createDuty(s, {
      title: 'Garden watering',
      participantKind: 'MEMBER',
      participantIds: [s.resident.membershipId, s.adminMembershipId],
      periodUnit: 'WEEK',
      startDate: TODAY,
      points: 2,
    });
    expect(duty.current).toMatchObject({ participant: { label: 'Resident d4' }, mine: false });
    const mineView = await h
      .http()
      .get(url(s, `/${duty.id}`))
      .set(auth(s.resident.token));
    expect(mineView.body.current.mine).toBe(true);
    expect(duty.next.periodStart).toBe(addDays(TODAY, 7));
    await h
      .http()
      .post(url(s, `/${duty.id}/assignments/${duty.current.id}/confirm`))
      .set(auth(s.resident.token));
    const points = await h
      .http()
      .get(`/v1/societies/${s.societyId}/rewards/me`)
      .set(auth(s.resident.token));
    expect(points.body).toMatchObject({
      points: 2,
      entries: [expect.objectContaining({ reason: 'DUTY', label: 'Garden watering' })],
    });
  });

  it('never leaks duties across societies', async () => {
    const a = await societyWithResident(h, 'd5');
    const b = await societyWithResident(h, 'd6');
    const duty = await createDuty(a);
    expect(
      (
        await h
          .http()
          .get(url(b, `/${duty.id}`))
          .set(auth(b.admin))
      ).status,
    ).toBe(404);
    const cross = await h
      .http()
      .post(url(b))
      .set(auth(b.admin))
      .send({ title: 'Theirs', participantIds: a.flats.map((f) => f.id), startDate: MONTH_START });
    expect(cross.status).toBe(400);
    const confirm = await h
      .http()
      .post(url(b, `/${duty.id}/assignments/${duty.current.id}/confirm`))
      .set(auth(b.admin));
    expect(confirm.status).toBe(404);
  });
});
