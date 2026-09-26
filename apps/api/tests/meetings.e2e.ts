import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RemindersJob } from '../src/modules/reminders/reminders.job';
import { auth, societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const HOUR = 3_600_000;
const inHours = (n: number) => new Date(Date.now() + n * HOUR).toISOString();

async function titles(token: string, prefix: string): Promise<string[]> {
  const res = await h.http().get('/v1/me/notifications?limit=50').set(auth(token));
  return res.body.items
    .map((n: { title: string }) => n.title)
    .filter((t: string) => t.startsWith(prefix));
}

describe('meetings', () => {
  it('committee schedules; members see it, get notified and see it on Home', async () => {
    const s = await societyWithResident(h, 'm1');
    const base = `/v1/societies/${s.societyId}/meetings`;
    const created = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({
        title: 'Monthly committee meeting',
        agenda: '1. Water tank\n2. Parking',
        location: 'Clubhouse',
        startsAt: inHours(48),
        endsAt: inHours(49),
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      title: 'Monthly committee meeting',
      status: 'SCHEDULED',
      location: 'Clubhouse',
      updates: [],
    });
    expect(created.body.createdBy.displayName).toBe('Society Admin');

    const byResident = await h
      .http()
      .post(base)
      .set(auth(s.resident.token))
      .send({ title: 'Mine', startsAt: inHours(5) });
    expect(byResident.status).toBe(403);
    const past = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({ title: 'Too late', startsAt: inHours(-1) });
    expect(past.status).toBe(400);
    const backwards = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({ title: 'Backwards', startsAt: inHours(5), endsAt: inHours(4) });
    expect(backwards.status).toBe(400);

    const list = await h.http().get(base).set(auth(s.resident.token));
    expect(list.status).toBe(200);
    expect(list.body.items.map((m: { id: string }) => m.id)).toEqual([created.body.id]);
    const pastList = await h.http().get(`${base}?when=PAST`).set(auth(s.resident.token));
    expect(pastList.body.items).toHaveLength(0);

    const note = (await h.http().get('/v1/me/notifications').set(auth(s.resident.token))).body
      .items[0];
    expect(note.category).toBe('MEETING');
    expect(note.title).toBe('New meeting: Monthly committee meeting');
    expect(note.body).toContain('Clubhouse');
    expect(note.data).toMatchObject({ screen: 'meeting', meetingId: created.body.id });
    expect(await titles(s.admin, 'New meeting')).toHaveLength(0);

    const home = await h
      .http()
      .get(`/v1/societies/${s.societyId}/home`)
      .set(auth(s.resident.token));
    expect(home.body.upcoming).toEqual([
      expect.objectContaining({ kind: 'MEETING', id: created.body.id, status: 'SCHEDULED' }),
    ]);
  });

  it('reschedules, posts updates, cancels and completes with a history', async () => {
    const s = await societyWithResident(h, 'm2');
    const base = `/v1/societies/${s.societyId}/meetings`;
    const m = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({ title: 'AGM', startsAt: inHours(72) });
    const url = `${base}/${m.body.id}`;

    const moved = await h
      .http()
      .patch(url)
      .set(auth(s.admin))
      .send({ startsAt: inHours(96), note: 'Hall booked on Sunday' });
    expect(moved.status).toBe(200);
    expect(moved.body.updates[0]).toMatchObject({
      kind: 'RESCHEDULED',
      body: 'Hall booked on Sunday',
      previousStartsAt: m.body.startsAt,
    });
    expect(await titles(s.resident.token, 'Meeting moved: AGM')).toHaveLength(1);

    const renamed = await h.http().patch(url).set(auth(s.admin)).send({ title: 'Annual AGM' });
    expect(renamed.body.title).toBe('Annual AGM');
    expect(renamed.body.updates).toHaveLength(1);

    const noted = await h
      .http()
      .post(`${url}/notes`)
      .set(auth(s.admin))
      .send({ note: 'Bring your ID card' });
    expect(noted.status).toBe(201);
    expect(noted.body.updates[0]).toMatchObject({ kind: 'NOTE', body: 'Bring your ID card' });
    expect(await titles(s.resident.token, 'Update: Annual AGM')).toHaveLength(1);

    const early = await h.http().post(`${url}/complete`).set(auth(s.admin)).send({});
    expect(early.status).toBe(409);

    const other = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({ title: 'Lift meeting', startsAt: inHours(10) });
    const cancelled = await h
      .http()
      .post(`${base}/${other.body.id}/cancel`)
      .set(auth(s.admin))
      .send({ note: 'Vendor not available' });
    expect(cancelled.body.status).toBe('CANCELLED');
    expect(cancelled.body.updates[0]).toMatchObject({
      kind: 'CANCELLED',
      body: 'Vendor not available',
    });
    const cancelNote = (await h.http().get('/v1/me/notifications').set(auth(s.resident.token))).body
      .items[0];
    expect(cancelNote).toMatchObject({
      title: 'Meeting cancelled: Lift meeting',
      body: 'Vendor not available',
    });
    const again = await h
      .http()
      .post(`${base}/${other.body.id}/cancel`)
      .set(auth(s.admin))
      .send({});
    expect(again.status).toBe(409);
    const upcoming = await h.http().get(base).set(auth(s.resident.token));
    expect(upcoming.body.items.map((x: { status: string }) => x.status)).toEqual([
      'CANCELLED',
      'SCHEDULED',
    ]);

    // Once the meeting has started, the committee marks it held and it moves to Past.
    await h.prisma.meeting.update({
      where: { id: m.body.id },
      data: { startsAt: new Date(Date.now() - HOUR) },
    });
    const done = await h
      .http()
      .post(`${url}/complete`)
      .set(auth(s.admin))
      .send({ note: 'Budget approved' });
    expect(done.status).toBe(201);
    expect(done.body.status).toBe('COMPLETED');
    const pastList = await h.http().get(`${base}?when=PAST`).set(auth(s.resident.token));
    expect(pastList.body.items.map((x: { id: string }) => x.id)).toEqual([m.body.id]);
    const editDone = await h.http().patch(url).set(auth(s.admin)).send({ title: 'Nope' });
    expect(editDone.status).toBe(409);

    const audit = await h.prisma.auditLog.findMany({
      where: { societyId: s.societyId, entityId: m.body.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((a) => a.action)).toEqual([
      'meeting.created',
      'meeting.rescheduled',
      'meeting.updated',
      'meeting.note_added',
      'meeting.completed',
    ]);
  });

  it('sends each reminder once, the most urgent first, and again after a move', async () => {
    const s = await societyWithResident(h, 'm3');
    const base = `/v1/societies/${s.societyId}/meetings`;
    const job = h.app.get(RemindersJob);
    const m = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({ title: 'Water meeting', location: 'Office', startsAt: inHours(30) });
    const start = new Date(m.body.startsAt).getTime();

    expect(await job.run(new Date(start - 25 * HOUR))).toBe(0);
    expect(await job.run(new Date(start - 23 * HOUR))).toBe(1);
    expect(await job.run(new Date(start - 22 * HOUR))).toBe(0);
    expect(await job.run(new Date(start - 30 * 60_000))).toBe(1);
    expect(await job.run(new Date(start - 10 * 60_000))).toBe(0);
    const reminders = await titles(s.resident.token, 'Reminder: Water meeting');
    expect(reminders).toHaveLength(2);
    // The admin scheduled it but still gets reminded.
    expect(await titles(s.admin, 'Reminder: Water meeting')).toHaveLength(2);

    const moved = await h
      .http()
      .patch(`${base}/${m.body.id}`)
      .set(auth(s.admin))
      .send({
        startsAt: inHours(50),
      });
    const newStart = new Date(moved.body.startsAt).getTime();
    expect(await job.run(new Date(newStart - 23 * HOUR))).toBe(1);

    // Scheduled 30 minutes ahead: the "new meeting" push already covers it.
    const soon = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({ title: 'Quick huddle', startsAt: inHours(0.5) });
    expect(await job.run(new Date(new Date(soon.body.startsAt).getTime() - 20 * 60_000))).toBe(0);

    // Cancelled meetings are not reminded.
    const cancelled = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({ title: 'Dropped', startsAt: inHours(40) });
    await h.http().post(`${base}/${cancelled.body.id}/cancel`).set(auth(s.admin)).send({});
    const cStart = new Date(cancelled.body.startsAt).getTime();
    expect(await job.run(new Date(cStart - 23 * HOUR))).toBe(0);
  });

  it('respects the audience and never leaks across societies', async () => {
    const s = await societyWithResident(h, 'm4');
    const other = await societyWithResident(h, 'm5');
    const base = `/v1/societies/${s.societyId}/meetings`;
    const forFlat102 = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({
        title: 'Flat 102 only',
        startsAt: inHours(20),
        audience: { type: 'FLATS', ids: [s.flats[1]?.id] },
      });
    expect(forFlat102.status).toBe(201);
    const list = await h.http().get(base).set(auth(s.resident.token));
    expect(list.body.items).toHaveLength(0);
    const get = await h.http().get(`${base}/${forFlat102.body.id}`).set(auth(s.resident.token));
    expect(get.status).toBe(404);
    expect(await titles(s.resident.token, 'New meeting')).toHaveLength(0);

    const outsider = await h.http().get(base).set(auth(other.resident.token));
    expect(outsider.status).toBe(404);
    const viaOwn = await h
      .http()
      .get(`/v1/societies/${other.societyId}/meetings/${forFlat102.body.id}`)
      .set(auth(other.admin));
    expect(viaOwn.status).toBe(404);
    const cancelViaOwn = await h
      .http()
      .post(`/v1/societies/${other.societyId}/meetings/${forFlat102.body.id}/cancel`)
      .set(auth(other.admin))
      .send({});
    expect(cancelViaOwn.status).toBe(404);
  });
});
