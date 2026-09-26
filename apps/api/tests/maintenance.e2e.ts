import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { newId } from '../src/common/util/ids';
import { todayIn } from '../src/modules/maintenance/billing';
import { BillsService } from '../src/modules/maintenance/bills.service';
import { MaintenanceJob } from '../src/modules/maintenance/maintenance.job';
import { auth, type SocietyFixture, societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

// Bills are made for 2030 so their due dates stay in the future for the real clock,
// which decides DUE versus OVERDUE when a payment refreshes them.
const at = (date: string) => new Date(`${date}T06:00:00Z`);
const TODAY = todayIn('Asia/Kolkata');

const base = (s: SocietyFixture) => `/v1/societies/${s.societyId}/maintenance`;

async function withPlan(s: SocietyFixture, extra: Record<string, unknown> = {}) {
  const res = await h
    .http()
    .post(`${base(s)}/plans`)
    .set(auth(s.admin))
    .send({
      name: 'Maintenance',
      amountPaise: 250_000,
      dueDay: 10,
      generateDaysBefore: 7,
      activeFrom: '2029-12-01',
      ...extra,
    });
  if (res.status !== 201) throw new Error(`plan: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

const pay = (s: SocietyFixture, body: Record<string, unknown>) =>
  h
    .http()
    .post(`${base(s)}/payments`)
    .set(auth(s.admin))
    .send({ paidOn: TODAY, method: 'UPI', idempotencyKey: newId(), ...body });

async function titles(token: string): Promise<string[]> {
  const res = await h.http().get('/v1/me/notifications?limit=50').set(auth(token));
  return res.body.items.map((n: { title: string }) => n.title);
}

describe('maintenance', () => {
  it('makes bills from a plan once, and members see their dues on Money and Home', async () => {
    const s = await societyWithResident(h, 'b1');
    const byResident = await h
      .http()
      .post(`${base(s)}/plans`)
      .set(auth(s.resident.token))
      .send({ name: 'Mine', amountPaise: 100, activeFrom: '2030-01-01' });
    expect(byResident.status).toBe(403);
    const plan = await withPlan(s);
    expect(plan).toMatchObject({
      frequency: 'MONTHLY',
      amountRule: 'FLAT_RATE',
      lateFee: { type: 'NONE' },
    });

    // The plan starts in the future, so "make bills now" finds nothing yet.
    const now = await h
      .http()
      .post(`${base(s)}/bills/generate`)
      .set(auth(s.admin));
    expect(now.body).toEqual({ created: 0, skippedFlats: [] });

    const bills = h.app.get(BillsService);
    expect((await bills.generateForSociety(s.societyId, at('2030-01-05'))).created).toBe(2);
    expect((await bills.generateForSociety(s.societyId, at('2030-01-06'))).created).toBe(0);

    const mine = await h
      .http()
      .get(`${base(s)}/me`)
      .set(auth(s.resident.token));
    expect(mine.status).toBe(200);
    expect(mine.body.flats).toHaveLength(1);
    expect(mine.body.flats[0]).toMatchObject({
      flat: { number: '101' },
      outstandingPaise: 250_000,
      creditPaise: 0,
      nextDueDate: '2030-01-10',
      overdue: false,
    });
    expect(mine.body.flats[0].openBills[0]).toMatchObject({
      title: 'Maintenance',
      periodKey: '2030-01',
      status: 'DUE',
    });
    expect(await titles(s.resident.token)).toContain('New bill: ₹2,500');

    const home = await h
      .http()
      .get(`/v1/societies/${s.societyId}/home`)
      .set(auth(s.resident.token));
    expect(home.body.attention[0]).toMatchObject({
      type: 'DUES',
      amountPaise: 250_000,
      dueDate: '2030-01-10',
      overdue: false,
    });

    // Members only see their own flat's bills; view_all sees every flat.
    const own = await h
      .http()
      .get(`${base(s)}/bills`)
      .set(auth(s.resident.token));
    expect(own.body.items).toHaveLength(1);
    const all = await h
      .http()
      .get(`${base(s)}/bills`)
      .set(auth(s.admin));
    expect(all.body.items).toHaveLength(2);
    const other = all.body.items.find((b: { flat: { number: string } }) => b.flat.number === '102');
    const peek = await h
      .http()
      .get(`${base(s)}/bills/${other.id}`)
      .set(auth(s.resident.token));
    expect(peek.status).toBe(404);
  });

  it('records payments once, oldest bill first, keeps advance and uses it on the next bill', async () => {
    const s = await societyWithResident(h, 'b2');
    await withPlan(s);
    const bills = h.app.get(BillsService);
    await bills.generateForSociety(s.societyId, at('2030-01-05'));
    const flat101 = s.flats[0]?.id;

    const key = newId();
    const first = await pay(s, { flatId: flat101, amountPaise: 100_000, idempotencyKey: key });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      amountPaise: 100_000,
      status: 'RECORDED',
      unallocatedPaise: 0,
      canReverse: true,
    });
    expect(first.body.receiptNo).toMatch(/^R-\d{4}-\d{2}-0001$/);
    expect(first.body.allocations).toEqual([
      expect.objectContaining({ periodKey: '2030-01', amountPaise: 100_000 }),
    ]);
    const again = await pay(s, { flatId: flat101, amountPaise: 100_000, idempotencyKey: key });
    expect(again.body.id).toBe(first.body.id);
    expect(await h.prisma.payment.count({ where: { societyId: s.societyId } })).toBe(1);
    expect(await titles(s.resident.token)).toContain('Payment received: ₹1,000');

    const byResident = await h
      .http()
      .post(`${base(s)}/payments`)
      .set(auth(s.resident.token))
      .send({
        flatId: flat101,
        amountPaise: 1,
        paidOn: TODAY,
        method: 'CASH',
        idempotencyKey: newId(),
      });
    expect(byResident.status).toBe(403);
    const future = await pay(s, { flatId: flat101, amountPaise: 100, paidOn: '2099-01-01' });
    expect(future.status).toBe(400);

    const second = await pay(s, { flatId: flat101, amountPaise: 400_000, method: 'CASH' });
    expect(second.body).toMatchObject({ unallocatedPaise: 250_000 });
    expect(second.body.receiptNo).toMatch(/-0002$/);
    let mine = (
      await h
        .http()
        .get(`${base(s)}/me`)
        .set(auth(s.resident.token))
    ).body.flats[0];
    expect(mine).toMatchObject({ outstandingPaise: 0, creditPaise: 250_000, openBills: [] });

    // February's bill is paid from the advance, so flat 101 is not asked to pay.
    await bills.generateForSociety(s.societyId, at('2030-02-05'));
    mine = (
      await h
        .http()
        .get(`${base(s)}/me`)
        .set(auth(s.resident.token))
    ).body.flats[0];
    expect(mine).toMatchObject({ outstandingPaise: 0, creditPaise: 0 });
    expect((await titles(s.resident.token)).filter((t) => t.startsWith('New bill'))).toHaveLength(
      1,
    );

    // Reversing the first payment reopens part of January.
    const reversed = await h
      .http()
      .post(`${base(s)}/payments/${first.body.id}/reverse`)
      .set(auth(s.admin))
      .send({ reason: 'Entered twice' });
    expect(reversed.body).toMatchObject({ status: 'REVERSED', reversedReason: 'Entered twice' });
    mine = (
      await h
        .http()
        .get(`${base(s)}/me`)
        .set(auth(s.resident.token))
    ).body.flats[0];
    expect(mine.outstandingPaise).toBe(100_000);
    expect(mine.openBills[0]).toMatchObject({ periodKey: '2030-01', status: 'PARTIALLY_PAID' });
    const twice = await h
      .http()
      .post(`${base(s)}/payments/${first.body.id}/reverse`)
      .set(auth(s.admin))
      .send({ reason: 'Again' });
    expect(twice.status).toBe(409);
    expect(await titles(s.resident.token)).toContain('Payment reversed: ₹1,000');

    const list = await h
      .http()
      .get(`${base(s)}/payments`)
      .set(auth(s.resident.token));
    expect(list.body.items.map((p: { status: string }) => p.status)).toEqual([
      'RECORDED',
      'REVERSED',
    ]);

    const audit = await h.prisma.auditLog.findMany({
      where: { societyId: s.societyId, action: { startsWith: 'payment.' } },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((a) => a.action)).toEqual([
      'payment.recorded',
      'payment.recorded',
      'payment.reversed',
    ]);
  });

  it('lets the treasurer choose bills, and refuses bad allocations', async () => {
    const s = await societyWithResident(h, 'b3');
    await withPlan(s);
    const bills = h.app.get(BillsService);
    await bills.generateForSociety(s.societyId, at('2030-01-05'));
    await bills.generateForSociety(s.societyId, at('2030-02-05'));
    const flat101 = s.flats[0]?.id;
    const open = (
      await h
        .http()
        .get(`${base(s)}/flats/${flat101}`)
        .set(auth(s.admin))
    ).body.openBills;
    expect(open.map((b: { periodKey: string }) => b.periodKey)).toEqual(['2030-01', '2030-02']);
    const feb = open[1].id;
    const chosen = await pay(s, {
      flatId: flat101,
      amountPaise: 250_000,
      allocations: [{ billId: feb, amountPaise: 250_000 }],
    });
    expect(chosen.body.allocations).toEqual([expect.objectContaining({ billId: feb })]);
    const tooMuch = await pay(s, {
      flatId: flat101,
      amountPaise: 300_000,
      allocations: [{ billId: open[0].id, amountPaise: 300_000 }],
    });
    expect(tooMuch.status).toBe(400);
    const paidBill = await pay(s, {
      flatId: flat101,
      amountPaise: 10,
      allocations: [{ billId: feb, amountPaise: 10 }],
    });
    expect(paidBill.status).toBe(400);
  });

  it('adds late fees after the grace days, and waives fees and bills', async () => {
    const s = await societyWithResident(h, 'b4');
    await withPlan(s, {
      lateFee: { type: 'PER_DAY', amountPaise: 1_000, graceDays: 2, capPaise: 5_000 },
    });
    const bills = h.app.get(BillsService);
    await bills.generateForSociety(s.societyId, at('2030-01-05'));
    await bills.applyLateFees(at('2030-01-12'));
    const flat101 = s.flats[0]?.id;
    let bill = (
      await h
        .http()
        .get(`${base(s)}/flats/${flat101}`)
        .set(auth(s.admin))
    ).body.openBills[0];
    expect(bill).toMatchObject({ lateFeePaise: 0 });
    await bills.applyLateFees(at('2030-01-15'));
    bill = (
      await h
        .http()
        .get(`${base(s)}/bills/${bill.id}`)
        .set(auth(s.admin))
    ).body;
    expect(bill).toMatchObject({ lateFeePaise: 3_000, totalPaise: 253_000, status: 'OVERDUE' });
    expect(bill.lines.map((l: { type: string }) => l.type)).toEqual(['BASE', 'LATE_FEE']);
    await bills.applyLateFees(at('2030-02-28'));
    bill = (
      await h
        .http()
        .get(`${base(s)}/bills/${bill.id}`)
        .set(auth(s.admin))
    ).body;
    expect(bill.lateFeePaise).toBe(5_000);

    const byResident = await h
      .http()
      .post(`${base(s)}/bills/${bill.id}/waive-late-fee`)
      .set(auth(s.resident.token))
      .send({ reason: 'Please' });
    expect(byResident.status).toBe(403);
    const noFee = await h
      .http()
      .post(`${base(s)}/bills/${bill.id}/waive-late-fee`)
      .set(auth(s.admin))
      .send({ reason: 'Was travelling' });
    expect(noFee.body).toMatchObject({ lateFeePaise: 0, totalPaise: 250_000, lateFeeWaived: true });
    await bills.applyLateFees(at('2030-03-01'));
    bill = (
      await h
        .http()
        .get(`${base(s)}/bills/${bill.id}`)
        .set(auth(s.admin))
    ).body;
    expect(bill.lateFeePaise).toBe(0);

    const waived = await h
      .http()
      .post(`${base(s)}/bills/${bill.id}/waive`)
      .set(auth(s.admin))
      .send({ reason: 'Hardship' });
    expect(waived.body).toMatchObject({
      status: 'WAIVED',
      outstandingPaise: 0,
      waivedReason: 'Hardship',
    });
    expect(await titles(s.resident.token)).toContain('Bill waived: Maintenance · Jan 2030');
    const waiveAgain = await h
      .http()
      .post(`${base(s)}/bills/${bill.id}/waive`)
      .set(auth(s.admin))
      .send({ reason: 'Again' });
    expect(waiveAgain.status).toBe(409);
  });

  it('reminds 3 days before, on the day and weekly after, once each', async () => {
    const s = await societyWithResident(h, 'b5');
    await withPlan(s);
    const bills = h.app.get(BillsService);
    await bills.generateForSociety(s.societyId, at('2030-01-05'));
    const reminders = async () =>
      (await titles(s.resident.token)).filter((t) => t.startsWith('Dues of'));
    await bills.sendDuesReminders(at('2030-01-06'));
    expect(await reminders()).toHaveLength(0);
    await bills.sendDuesReminders(at('2030-01-07'));
    await bills.sendDuesReminders(at('2030-01-08'));
    expect(await reminders()).toEqual(['Dues of ₹2,500 due 10 Jan']);
    await bills.sendDuesReminders(at('2030-01-10'));
    await bills.sendDuesReminders(at('2030-01-25'));
    expect(await reminders()).toEqual([
      'Dues of ₹2,500 are overdue',
      'Dues of ₹2,500 due today',
      'Dues of ₹2,500 due 10 Jan',
    ]);
  });

  it('per sq ft plans skip flats without an area; overrides and one-off bills', async () => {
    const s = await societyWithResident(h, 'b6');
    const [f101, f102] = s.flats;
    await h
      .http()
      .patch(`/v1/societies/${s.societyId}/flats/${f101?.id}`)
      .set(auth(s.admin))
      .send({ areaSqft: 800 });
    const plan = await withPlan(s, { amountRule: 'PER_SQFT', amountPaise: 300 });
    const job = h.app.get(MaintenanceJob);
    const bills = h.app.get(BillsService);
    const first = await bills.generateForSociety(s.societyId, at('2030-01-05'));
    expect(first.created).toBe(1);
    expect(first.skippedFlats).toEqual([expect.objectContaining({ number: '102' })]);

    const withOverride = await h
      .http()
      .put(`${base(s)}/plans/${plan.id}/overrides`)
      .set(auth(s.admin))
      .send({ flatId: f102?.id, amountPaise: 199_900 });
    expect(withOverride.body.overrides).toEqual([
      { flat: expect.objectContaining({ number: '102' }), amountPaise: 199_900 },
    ]);
    expect(await job.generateAll(at('2030-01-06'))).toBe(1);
    const all = await h
      .http()
      .get(`${base(s)}/bills`)
      .set(auth(s.admin));
    expect(
      all.body.items.map((b: { flat: { number: string }; totalPaise: number }) => [
        b.flat.number,
        b.totalPaise,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ['101', 240_000],
        ['102', 199_900],
      ]),
    );

    const adhoc = await h
      .http()
      .post(`${base(s)}/bills/adhoc`)
      .set(auth(s.admin))
      .send({ title: 'Painting fund', amountPaise: 500_000, dueDate: '2030-03-31' });
    expect(adhoc.body).toEqual({ created: 2 });
    const mine = (
      await h
        .http()
        .get(`${base(s)}/me`)
        .set(auth(s.resident.token))
    ).body.flats[0];
    expect(mine.openBills.map((b: { kind: string; title: string }) => b.title)).toEqual([
      'Maintenance',
      'Painting fund',
    ]);
  });

  it('shows collection status by the transparency setting', async () => {
    const s = await societyWithResident(h, 'b7');
    await withPlan(s);
    await h.app.get(BillsService).generateForSociety(s.societyId, at('2030-01-05'));
    await pay(s, { flatId: s.flats[0]?.id, amountPaise: 250_000 });

    const resident = await h
      .http()
      .get(`${base(s)}/collection`)
      .set(auth(s.resident.token));
    expect(resident.status).toBe(200);
    expect(resident.body).toMatchObject({
      showAmounts: false,
      counts: { flats: 2, paid: 1, due: 1, overdue: 0 },
      billedPaise: null,
    });
    expect(
      resident.body.rows.map((r: { status: string; outstandingPaise: null }) => r.outstandingPaise),
    ).toEqual([null, null]);

    const admin = await h
      .http()
      .get(`${base(s)}/collection`)
      .set(auth(s.admin));
    expect(admin.body).toMatchObject({ showAmounts: true, outstandingPaise: 250_000 });
    expect(admin.body.rows[1]).toMatchObject({
      flat: { number: '102' },
      status: 'DUE',
      outstandingPaise: 250_000,
    });

    await h
      .http()
      .patch(`/v1/societies/${s.societyId}/modules/maintenance`)
      .set(auth(s.admin))
      .send({ settings: { transparency: 'OFF' } });
    const hidden = await h
      .http()
      .get(`${base(s)}/collection`)
      .set(auth(s.resident.token));
    expect(hidden.status).toBe(403);
  });

  it('keeps payment details, with UPI ids checked; residents see active ones', async () => {
    const s = await societyWithResident(h, 'b8');
    const url = `${base(s)}/instructions`;
    const bad = await h
      .http()
      .post(url)
      .set(auth(s.admin))
      .send({ kind: 'UPI', label: 'Society UPI', value: 'not a upi' });
    expect(bad.status).toBe(400);
    const upi = await h.http().post(url).set(auth(s.admin)).send({
      kind: 'UPI',
      label: 'Society UPI',
      value: 'sunrise@okaxis',
      payeeName: 'Sunrise CHS',
    });
    expect(upi.status).toBe(201);
    const bank = await h
      .http()
      .post(url)
      .set(auth(s.admin))
      .send({ kind: 'BANK', label: 'Bank', value: 'HDFC 0123 IFSC HDFC0000123', isActive: false });
    expect((await h.http().get(url).set(auth(s.resident.token))).body).toEqual([
      expect.objectContaining({ id: upi.body.id, value: 'sunrise@okaxis' }),
    ]);
    expect((await h.http().get(url).set(auth(s.admin))).body).toHaveLength(2);
    await h.http().patch(`${url}/${bank.body.id}`).set(auth(s.admin)).send({ isActive: true });
    expect((await h.http().get(url).set(auth(s.resident.token))).body).toHaveLength(2);
    const del = await h.http().delete(`${url}/${bank.body.id}`).set(auth(s.admin));
    expect(del.status).toBe(200);
    const byResident = await h
      .http()
      .post(url)
      .set(auth(s.resident.token))
      .send({ kind: 'OTHER', label: 'Me', value: 'cash to me' });
    expect(byResident.status).toBe(403);
  });

  it('never leaks bills or payments across societies', async () => {
    const a = await societyWithResident(h, 'b9');
    const b = await societyWithResident(h, 'b10');
    await withPlan(a);
    await h.app.get(BillsService).generateForSociety(a.societyId, at('2030-01-05'));
    const p = await pay(a, { flatId: a.flats[0]?.id, amountPaise: 1_000 });
    const billId = p.body.allocations[0].billId;

    expect(
      (
        await h
          .http()
          .get(`${base(b)}/bills/${billId}`)
          .set(auth(b.admin))
      ).status,
    ).toBe(404);
    expect(
      (
        await h
          .http()
          .get(`${base(b)}/payments/${p.body.id}`)
          .set(auth(b.admin))
      ).status,
    ).toBe(404);
    const crossPay = await pay(b, { flatId: a.flats[0]?.id, amountPaise: 1_000 });
    expect(crossPay.status).toBe(404);
    const crossReverse = await h
      .http()
      .post(`${base(b)}/payments/${p.body.id}/reverse`)
      .set(auth(b.admin))
      .send({ reason: 'Not mine' });
    expect(crossReverse.status).toBe(404);
    expect(
      (
        await h
          .http()
          .get(`${base(b)}/bills`)
          .set(auth(b.admin))
      ).body.items,
    ).toHaveLength(0);
    expect(
      (
        await h
          .http()
          .get(`${base(a)}/me`)
          .set(auth(b.resident.token))
      ).status,
    ).toBe(404);
  });
});
