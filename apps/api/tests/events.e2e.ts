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

describe('events', () => {
  it('publishes an event; members answer and organisers see who is coming', async () => {
    const s = await societyWithResident(h, 'v1');
    const base = `/v1/societies/${s.societyId}/events`;
    const created = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({
        title: 'Diwali celebration',
        description: 'Rangoli, snacks and lights',
        location: 'Society garden',
        startsAt: inHours(72),
        endsAt: inHours(75),
      });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      status: 'PUBLISHED',
      rsvpEnabled: true,
      goingCount: 0,
      myRsvp: null,
      counts: { going: 0, maybe: 0, notGoing: 0, guests: 0 },
    });
    expect(await titles(s.resident.token, 'New event: Diwali celebration')).toHaveLength(1);

    const byResident = await h
      .http()
      .post(base)
      .set(auth(s.resident.token))
      .send({ title: 'Party', startsAt: inHours(5) });
    expect(byResident.status).toBe(403);

    const url = `${base}/${created.body.id}`;
    const going = await h
      .http()
      .put(`${url}/rsvp`)
      .set(auth(s.resident.token))
      .send({ response: 'GOING', guestsCount: 2 });
    expect(going.status).toBe(200);
    expect(going.body).toMatchObject({
      myRsvp: { response: 'GOING', guestsCount: 2 },
      goingCount: 3,
      counts: { going: 1, guests: 2 },
    });
    const tooMany = await h
      .http()
      .put(`${url}/rsvp`)
      .set(auth(s.resident.token))
      .send({ response: 'GOING', guestsCount: 11 });
    expect(tooMany.status).toBe(400);
    await h
      .http()
      .put(`${url}/rsvp`)
      .set(auth(s.admin))
      .send({ response: 'MAYBE', guestsCount: 4 });

    const list = await h.http().get(base).set(auth(s.resident.token));
    expect(list.body.items[0]).toMatchObject({
      id: created.body.id,
      goingCount: 3,
      myRsvp: { response: 'GOING', guestsCount: 2 },
    });

    const rsvps = await h.http().get(`${url}/rsvps`).set(auth(s.admin));
    expect(rsvps.status).toBe(200);
    expect(rsvps.body).toEqual([
      expect.objectContaining({
        displayName: 'Resident v1',
        response: 'GOING',
        guestsCount: 2,
        flats: [expect.objectContaining({ number: '101' })],
      }),
      // MAYBE never carries guests.
      expect.objectContaining({ displayName: 'Society Admin', response: 'MAYBE', guestsCount: 0 }),
    ]);
    const residentRsvps = await h.http().get(`${url}/rsvps`).set(auth(s.resident.token));
    expect(residentRsvps.status).toBe(403);

    const declined = await h
      .http()
      .put(`${url}/rsvp`)
      .set(auth(s.resident.token))
      .send({ response: 'NOT_GOING', guestsCount: 3 });
    expect(declined.body).toMatchObject({
      myRsvp: { response: 'NOT_GOING', guestsCount: 0 },
      counts: { going: 0, maybe: 1, notGoing: 1, guests: 0 },
    });

    const home = await h
      .http()
      .get(`/v1/societies/${s.societyId}/home`)
      .set(auth(s.resident.token));
    expect(home.body.upcoming).toEqual([
      expect.objectContaining({
        kind: 'EVENT',
        id: created.body.id,
        myRsvp: { response: 'NOT_GOING', guestsCount: 0 },
      }),
    ]);
  });

  it('closes answers when RSVP is off, cancelled or over; edits notify on a move', async () => {
    const s = await societyWithResident(h, 'v2');
    const base = `/v1/societies/${s.societyId}/events`;
    const noRsvp = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({ title: 'Cleanliness drive', startsAt: inHours(30), rsvpEnabled: false });
    const closed = await h
      .http()
      .put(`${base}/${noRsvp.body.id}/rsvp`)
      .set(auth(s.resident.token))
      .send({ response: 'GOING' });
    expect(closed.status).toBe(409);

    const moved = await h
      .http()
      .patch(`${base}/${noRsvp.body.id}`)
      .set(auth(s.admin))
      .send({ startsAt: inHours(54), location: 'Main gate' });
    expect(moved.body.location).toBe('Main gate');
    expect(await titles(s.resident.token, 'Event moved: Cleanliness drive')).toHaveLength(1);

    const cancelled = await h
      .http()
      .post(`${base}/${noRsvp.body.id}/cancel`)
      .set(auth(s.admin))
      .send({ reason: 'Rain expected' });
    expect(cancelled.body.status).toBe('CANCELLED');
    const note = (await h.http().get('/v1/me/notifications').set(auth(s.resident.token))).body
      .items[0];
    expect(note).toMatchObject({
      title: 'Event cancelled: Cleanliness drive',
      body: 'Rain expected',
    });
    const editCancelled = await h
      .http()
      .patch(`${base}/${noRsvp.body.id}`)
      .set(auth(s.admin))
      .send({ title: 'Back on' });
    expect(editCancelled.status).toBe(409);

    const over = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({ title: 'Yoga', startsAt: inHours(2) });
    await h.prisma.societyEvent.update({
      where: { id: over.body.id },
      data: { startsAt: new Date(Date.now() - 3 * HOUR) },
    });
    const late = await h
      .http()
      .put(`${base}/${over.body.id}/rsvp`)
      .set(auth(s.resident.token))
      .send({ response: 'GOING' });
    expect(late.status).toBe(409);
    const past = await h.http().get(`${base}?when=PAST`).set(auth(s.resident.token));
    expect(past.body.items.map((e: { id: string }) => e.id)).toEqual([over.body.id]);
  });

  it('reminds a day before and skips members who cannot come', async () => {
    const s = await societyWithResident(h, 'v3');
    const base = `/v1/societies/${s.societyId}/events`;
    const job = h.app.get(RemindersJob);
    const e = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({ title: 'Movie night', startsAt: inHours(40) });
    await h
      .http()
      .put(`${base}/${e.body.id}/rsvp`)
      .set(auth(s.resident.token))
      .send({ response: 'NOT_GOING' });
    const start = new Date(e.body.startsAt).getTime();
    expect(await job.run(new Date(start - 25 * HOUR))).toBe(0);
    expect(await job.run(new Date(start - 23 * HOUR))).toBe(1);
    expect(await job.run(new Date(start - HOUR))).toBe(0);
    expect(await titles(s.admin, 'Tomorrow: Movie night')).toHaveLength(1);
    expect(await titles(s.resident.token, 'Tomorrow: Movie night')).toHaveLength(0);
  });

  it('Home lists meetings and events together, soonest first', async () => {
    const s = await societyWithResident(h, 'v4');
    await h
      .http()
      .post(`/v1/societies/${s.societyId}/events`)
      .set(auth(s.admin))
      .send({ title: 'Holi', startsAt: inHours(50) });
    await h
      .http()
      .post(`/v1/societies/${s.societyId}/meetings`)
      .set(auth(s.admin))
      .send({ title: 'Committee', startsAt: inHours(20) });
    await h
      .http()
      .post(`/v1/societies/${s.societyId}/events`)
      .set(auth(s.admin))
      .send({ title: 'Far away', startsAt: inHours(24 * 20) });
    const home = await h
      .http()
      .get(`/v1/societies/${s.societyId}/home`)
      .set(auth(s.resident.token));
    expect(
      home.body.upcoming.map((u: { kind: string; title: string }) => `${u.kind}:${u.title}`),
    ).toEqual(['MEETING:Committee', 'EVENT:Holi']);
  });

  it('never leaks events across societies', async () => {
    const a = await societyWithResident(h, 'v5');
    const b = await societyWithResident(h, 'v6');
    const e = await h
      .http()
      .post(`/v1/societies/${a.societyId}/events`)
      .set(auth(a.admin))
      .send({ title: 'A only', startsAt: inHours(10) });
    const viaB = await h
      .http()
      .get(`/v1/societies/${b.societyId}/events/${e.body.id}`)
      .set(auth(b.admin));
    expect(viaB.status).toBe(404);
    const rsvpViaB = await h
      .http()
      .put(`/v1/societies/${b.societyId}/events/${e.body.id}/rsvp`)
      .set(auth(b.resident.token))
      .send({ response: 'GOING' });
    expect(rsvpViaB.status).toBe(404);
    const listB = await h
      .http()
      .get(`/v1/societies/${b.societyId}/events`)
      .set(auth(b.resident.token));
    expect(listB.body.items).toHaveLength(0);
    const direct = await h
      .http()
      .get(`/v1/societies/${a.societyId}/events`)
      .set(auth(b.resident.token));
    expect(direct.status).toBe(404);
  });
});
