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

const TODAY = todayIn('Asia/Kolkata');
const url = (s: { societyId: string }, rest = '') => `/v1/societies/${s.societyId}${rest}`;

async function post(token: string, path: string, body: Record<string, unknown>) {
  const res = await h.http().post(path).set(auth(token)).send(body);
  if (res.status !== 201) throw new Error(`${path}: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

async function withMarket(tag: string): Promise<SocietyFixture> {
  const s = await societyWithResident(h, tag);
  await h.http().patch(url(s, '/modules/marketplace')).set(auth(s.admin)).send({ enabled: true });
  return s;
}

const item = {
  kind: 'FOOD',
  title: 'Poha',
  priceType: 'PER_UNIT',
  pricePaise: 6000,
  unit: 'plate',
  diet: 'VEG',
  quantityAvailable: 5,
  fulfilment: 'BOTH',
};

/** Tasks, a member duty whose turn is theirs now, a listing with an order, and an order they placed. */
async function giveWork(s: SocietyFixture, member: { token: string; membershipId: string }) {
  const task = await post(s.admin, url(s, '/tasks'), {
    title: 'Fix the gate',
    assigneeMembershipId: member.membershipId,
  });
  const duty = await post(s.admin, url(s, '/duties'), {
    title: 'Garden watering',
    participantKind: 'MEMBER',
    participantIds: [member.membershipId, s.adminMembershipId],
    periodUnit: 'WEEK',
    startDate: TODAY,
  });
  const mine = await post(member.token, url(s, '/market/listings'), { ...item, title: 'Cycle' });
  const theirs = await post(s.admin, url(s, '/market/listings'), { ...item, title: 'Chai' });
  const sold = await post(s.admin, url(s, `/market/listings/${mine.id}/orders`), { quantity: 1 });
  const bought = await post(member.token, url(s, `/market/listings/${theirs.id}/orders`), {
    quantity: 1,
  });
  return { task, duty, mine, theirs, orders: [sold.id as string, bought.id as string] };
}

describe('member left', () => {
  it('releases the leaver’s tasks, duty turns, listings and orders in that society only', async () => {
    const a = await withMarket('ml-a');
    const b = await withMarket('ml-b');
    const r = a.resident;
    // The same person also lives in society B.
    const invite = await post(b.admin, url(b, '/invitations'), {
      inviteeName: 'Resident A',
      flatId: b.flats[1]?.id,
    });
    await post(r.token, '/v1/join/invite', { code: invite.code });
    const ctx = await h.http().get('/v1/me/context').set(auth(r.token));
    const inB = ctx.body.memberships.find(
      (m: { society: { id: string } }) => m.society.id === b.societyId,
    ).id as string;

    const workA = await giveWork(a, r);
    const workB = await giveWork(b, { token: r.token, membershipId: inB });
    expect(workA.duty.current.participant.id).toBe(r.membershipId);

    const left = await h
      .http()
      .patch(url(a, `/members/${r.membershipId}`))
      .set(auth(a.admin))
      .send({ status: 'LEFT' });
    expect(left.status).toBe(200);
    expect(left.body.status).toBe('LEFT');

    // Task: back on the open list, written like an unassign.
    const task = await h.prisma.task.findUniqueOrThrow({ where: { id: workA.task.id } });
    expect([task.status, task.assigneeMembershipId]).toEqual(['OPEN', null]);
    const events = await h.prisma.taskEvent.findMany({
      where: { taskId: task.id },
      orderBy: { createdAt: 'desc' },
    });
    expect(events[0]?.kind).toBe('WITHDRAWN');

    // Duty: out of the rotation, running turn skipped, later turns go to the admin.
    const duty = await h
      .http()
      .get(url(a, `/duties/${workA.duty.id}`))
      .set(auth(a.admin));
    expect(duty.body.participants).toEqual([{ id: a.adminMembershipId, label: 'Society Admin' }]);
    expect(duty.body.current).toMatchObject({
      id: workA.duty.current.id,
      status: 'SKIPPED',
      overrideNote: 'Member left',
    });
    expect(
      duty.body.upcoming.every(
        (u: { participant: { id: string } }) => u.participant.id === a.adminMembershipId,
      ),
    ).toBe(true);

    // Market: their listing archived, the admin's stays; both open orders cancelled.
    const listings = await h.prisma.listing.findMany({ where: { societyId: a.societyId } });
    expect(Object.fromEntries(listings.map((l) => [l.title, l.status]))).toEqual({
      Cycle: 'ARCHIVED',
      Chai: 'ACTIVE',
    });
    const orders = await h.prisma.marketOrder.findMany({ where: { id: { in: workA.orders } } });
    expect(orders.map((o) => [o.status, o.reason])).toEqual([
      ['CANCELLED', 'member left'],
      ['CANCELLED', 'member left'],
    ]);

    // Society B: nothing moved.
    const taskB = await h.prisma.task.findUniqueOrThrow({ where: { id: workB.task.id } });
    expect(taskB.assigneeMembershipId).toBe(inB);
    const dutyB = await h
      .http()
      .get(url(b, `/duties/${workB.duty.id}`))
      .set(auth(b.admin));
    expect(dutyB.body.participants).toHaveLength(2);
    expect(dutyB.body.current).toMatchObject({ status: 'ACTIVE', participant: { id: inB } });
    expect(
      (await h.prisma.listing.findUniqueOrThrow({ where: { id: workB.mine.id } })).status,
    ).toBe('ACTIVE');
    const ordersB = await h.prisma.marketOrder.findMany({ where: { id: { in: workB.orders } } });
    expect(ordersB.every((o) => o.status !== 'CANCELLED')).toBe(true);
  });

  it('does nothing more when a member already LEFT is set to LEFT again', async () => {
    const s = await withMarket('ml-again');
    const r = s.resident;
    const set = () =>
      h
        .http()
        .patch(url(s, `/members/${r.membershipId}`))
        .set(auth(s.admin))
        .send({ status: 'LEFT' });
    expect((await set()).status).toBe(200);
    const task = await post(s.admin, url(s, '/tasks'), { title: 'Later task' });
    const before = await h.prisma.auditLog.count();
    expect((await set()).status).toBe(200);
    // Only the status audit row; no release work ran again.
    expect(await h.prisma.auditLog.count()).toBe(before + 1);
    expect((await h.prisma.task.findUniqueOrThrow({ where: { id: task.id } })).status).toBe('OPEN');
  });
});
