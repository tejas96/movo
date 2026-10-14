import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addDays, fyLabel, todayIn } from '../src/common/util/dates';
import { newId } from '../src/common/util/ids';
import { auth, type SocietyFixture, societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const TODAY = todayIn('Asia/Kolkata');
const url = (s: SocietyFixture, rest = '') => `/v1/societies/${s.societyId}${rest}`;

async function categoryId(s: SocietyFixture, key: string): Promise<string> {
  const res = await h.http().get(url(s, '/expenses/categories')).set(auth(s.admin));
  return res.body.find((c: { key: string }) => c.key === key).id;
}

async function makeCommittee(s: SocietyFixture) {
  const roles = await h.http().get(url(s, '/roles')).set(auth(s.admin));
  const committee = roles.body.find((r: { key: string }) => r.key === 'committee');
  const res = await h
    .http()
    .patch(url(s, `/members/${s.resident.membershipId}`))
    .set(auth(s.admin))
    .send({ roleIds: [committee.id] });
  if (res.status !== 200) throw new Error(`role: ${res.status} ${JSON.stringify(res.body)}`);
}

const spend = (s: SocietyFixture, token: string, body: Record<string, unknown>) =>
  h
    .http()
    .post(url(s, '/expenses'))
    .set(auth(token))
    .send({
      amountPaise: 120_000,
      incurredOn: TODAY,
      payeeName: 'MSEDCL',
      method: 'BANK_TRANSFER',
      idempotencyKey: newId(),
      ...body,
    });

async function titles(token: string): Promise<string[]> {
  const res = await h.http().get('/v1/me/notifications?limit=50').set(auth(token));
  return res.body.items.map((n: { title: string }) => n.title);
}

const setExpenses = (s: SocietyFixture, settings: Record<string, unknown>) =>
  h.http().patch(url(s, '/modules/expenses')).set(auth(s.admin)).send({ settings });

describe('expenses', () => {
  it('needs someone else to approve a large expense; small ones go straight through', async () => {
    const s = await societyWithResident(h, 'x1');
    await makeCommittee(s);
    const electricity = await categoryId(s, 'electricity');

    const small = await spend(s, s.admin, { categoryId: electricity });
    expect(small.status).toBe(201);
    expect(small.body).toMatchObject({ status: 'APPROVED', canDecide: false, canEdit: false });

    const key = newId();
    const big = await spend(s, s.admin, {
      categoryId: electricity,
      amountPaise: 800_000,
      description: 'Pump motor rewinding',
      idempotencyKey: key,
    });
    expect(big.body).toMatchObject({ status: 'PENDING', canDecide: false, canEdit: true });
    const again = await spend(s, s.admin, {
      categoryId: electricity,
      amountPaise: 800_000,
      idempotencyKey: key,
    });
    expect(again.body.id).toBe(big.body.id);
    expect(await titles(s.resident.token)).toContain('Approve expense: ₹8,000');

    const home = await h.http().get(url(s, '/home')).set(auth(s.resident.token));
    expect(home.body.attention).toContainEqual({
      type: 'EXPENSES_TO_APPROVE',
      count: 1,
      amountPaise: 800_000,
    });

    const self = await h
      .http()
      .post(url(s, `/expenses/${big.body.id}/approve`))
      .set(auth(s.admin));
    expect(self.status).toBe(403);
    const ok = await h
      .http()
      .post(url(s, `/expenses/${big.body.id}/approve`))
      .set(auth(s.resident.token));
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({
      status: 'APPROVED',
      decidedBy: { displayName: 'Resident x1' },
    });
    expect(await titles(s.admin)).toContain('Expense approved: ₹8,000');
    const twice = await h
      .http()
      .post(url(s, `/expenses/${big.body.id}/approve`))
      .set(auth(s.resident.token));
    expect(twice.status).toBe(409);
    const edit = await h
      .http()
      .patch(url(s, `/expenses/${big.body.id}`))
      .set(auth(s.admin))
      .send({ amountPaise: 1 });
    expect(edit.status).toBe(409);

    await setExpenses(s, { approval: 'NEVER' });
    const never = await spend(s, s.admin, { categoryId: electricity, amountPaise: 9_900_000 });
    expect(never.body.status).toBe('APPROVED');
    await setExpenses(s, { approval: 'ALWAYS' });
    const always = await spend(s, s.admin, { categoryId: electricity, amountPaise: 100 });
    expect(always.body.status).toBe('PENDING');

    const pending = await h.http().get(url(s, '/expenses?status=PENDING')).set(auth(s.admin));
    expect(pending.body.items).toHaveLength(1);
  });

  it('rejects with a reason; an edit sends it back; rejected ones can be removed', async () => {
    const s = await societyWithResident(h, 'x2');
    await makeCommittee(s);
    const repairs = await categoryId(s, 'repairs');
    const e = await spend(s, s.admin, {
      categoryId: repairs,
      amountPaise: 900_000,
      payeeName: 'Kiran Works',
    });
    const rejected = await h
      .http()
      .post(url(s, `/expenses/${e.body.id}/reject`))
      .set(auth(s.resident.token))
      .send({ reason: 'Need two quotes' });
    expect(rejected.body).toMatchObject({ status: 'REJECTED', rejectionReason: 'Need two quotes' });
    expect(await titles(s.admin)).toContain('Expense rejected: ₹9,000');

    const edited = await h
      .http()
      .patch(url(s, `/expenses/${e.body.id}`))
      .set(auth(s.admin))
      .send({ amountPaise: 450_000 });
    expect(edited.body).toMatchObject({
      status: 'APPROVED',
      rejectionReason: null,
      amountPaise: 450_000,
    });

    const other = await spend(s, s.admin, { categoryId: repairs, amountPaise: 700_000 });
    await h
      .http()
      .post(url(s, `/expenses/${other.body.id}/reject`))
      .set(auth(s.resident.token))
      .send({ reason: 'Duplicate' });
    const del = await h
      .http()
      .delete(url(s, `/expenses/${other.body.id}`))
      .set(auth(s.admin));
    expect(del.status).toBe(200);
    expect(
      (
        await h
          .http()
          .get(url(s, `/expenses/${other.body.id}`))
          .set(auth(s.admin))
      ).status,
    ).toBe(404);
    const delApproved = await h
      .http()
      .delete(url(s, `/expenses/${e.body.id}`))
      .set(auth(s.admin));
    expect(delApproved.status).toBe(409);

    const future = await spend(s, s.admin, { categoryId: repairs, incurredOn: '2099-01-01' });
    expect(future.status).toBe(400);

    const audit = await h.prisma.auditLog.findMany({
      where: { societyId: s.societyId, entityId: e.body.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((a) => a.action)).toEqual([
      'expense.created',
      'expense.rejected',
      'expense.updated',
    ]);
  });

  it('pages by spend date, newest first, with the date|id cursor', async () => {
    const s = await societyWithResident(h, 'xp');
    const water = await categoryId(s, 'water');
    for (const [payeeName, days] of [
      ['Old', -3],
      ['Mid A', -2],
      ['Mid B', -2],
      ['New', -1],
    ] as const)
      await spend(s, s.admin, {
        categoryId: water,
        amountPaise: 100,
        payeeName,
        incurredOn: addDays(TODAY, days),
      });
    const first = await h.http().get(url(s, '/expenses?limit=2')).set(auth(s.admin));
    expect(first.body.items).toHaveLength(2);
    const last = first.body.items[1];
    expect(Buffer.from(first.body.nextCursor, 'base64url').toString()).toBe(
      `${last.incurredOn}T00:00:00.000Z|${last.id}`,
    );
    const second = await h
      .http()
      .get(url(s, `/expenses?limit=2&cursor=${first.body.nextCursor}`))
      .set(auth(s.admin));
    expect(second.body.nextCursor).toBeNull();
    const all = [...first.body.items, ...second.body.items];
    expect(all.map((e: { payeeName: string }) => e.payeeName)[0]).toBe('New');
    expect(all.map((e: { payeeName: string }) => e.payeeName)[3]).toBe('Old');
    expect(new Set(all.map((e: { id: string }) => e.id)).size).toBe(4);
  });

  it('shows members a summary, details or nothing, by the society setting', async () => {
    const s = await societyWithResident(h, 'x3');
    const water = await categoryId(s, 'water');
    await spend(s, s.admin, { categoryId: water, amountPaise: 300_000, payeeName: 'Tanker' });
    await spend(s, s.admin, { categoryId: water, amountPaise: 900_000, payeeName: 'Big tanker' });

    const add = await spend(s, s.resident.token, { categoryId: water });
    expect(add.status).toBe(403);

    // Default SUMMARY: the report but not the list.
    expect((await h.http().get(url(s, '/expenses')).set(auth(s.resident.token))).status).toBe(403);
    const summary = await h.http().get(url(s, '/finance/report')).set(auth(s.resident.token));
    expect(summary.status).toBe(200);
    expect(summary.body).toMatchObject({
      expenses: { totalPaise: 300_000 },
      pending: null,
      outstandingDuesPaise: null,
    });

    await setExpenses(s, { visibleToMembers: 'DETAILED' });
    const list = await h.http().get(url(s, '/expenses')).set(auth(s.resident.token));
    expect(list.body.items.map((e: { payeeName: string }) => e.payeeName)).toEqual(['Tanker']);

    await setExpenses(s, { visibleToMembers: 'NONE' });
    expect((await h.http().get(url(s, '/finance/report')).set(auth(s.resident.token))).status).toBe(
      403,
    );
  });

  it('adds up the year: maintenance, other income, spending by category and month', async () => {
    const s = await societyWithResident(h, 'x4');
    const flat = s.flats[0]?.id;
    await h.http().post(url(s, '/maintenance/payments')).set(auth(s.admin)).send({
      flatId: flat,
      amountPaise: 250_000,
      paidOn: TODAY,
      method: 'UPI',
      idempotencyKey: newId(),
    });
    const income = await h.http().post(url(s, '/income')).set(auth(s.admin)).send({
      kind: 'HALL_BOOKING',
      amountPaise: 100_000,
      receivedOn: TODAY,
      description: 'Birthday party',
    });
    expect(income.status).toBe(201);
    await spend(s, s.admin, {
      categoryId: await categoryId(s, 'electricity'),
      amountPaise: 120_000,
    });
    await spend(s, s.admin, { categoryId: await categoryId(s, 'water'), amountPaise: 30_000 });
    await spend(s, s.admin, { categoryId: await categoryId(s, 'lift'), amountPaise: 1_800_000 });

    const report = await h.http().get(url(s, '/finance/report')).set(auth(s.admin));
    expect(report.status).toBe(200);
    const fy = report.body.financialYear;
    expect(report.body.years).toEqual([fy]);
    expect(report.body.income).toEqual({
      maintenancePaise: 250_000,
      byKind: [{ kind: 'HALL_BOOKING', amountPaise: 100_000 }],
      totalPaise: 350_000,
    });
    expect(report.body.expenses.totalPaise).toBe(150_000);
    expect(
      report.body.expenses.byCategory.map((c: { category: { key: string } }) => c.category.key),
    ).toEqual(['electricity', 'water']);
    expect(report.body.netPaise).toBe(200_000);
    expect(report.body.pending).toEqual({ count: 1, amountPaise: 1_800_000 });
    expect(report.body.months).toHaveLength(12);
    expect(
      report.body.months.find((m: { month: string }) => m.month === TODAY.slice(0, 7)),
    ).toEqual({
      month: TODAY.slice(0, 7),
      incomePaise: 350_000,
      expensePaise: 150_000,
    });
    const empty = await h.http().get(url(s, '/finance/report?fy=2019-20')).set(auth(s.admin));
    expect(empty.body).toMatchObject({ netPaise: 0, income: { totalPaise: 0 } });

    const incomeList = await h.http().get(url(s, '/income')).set(auth(s.admin));
    expect(incomeList.body).toHaveLength(1);
    expect((await h.http().get(url(s, '/income')).set(auth(s.resident.token))).status).toBe(403);
    await h
      .http()
      .delete(url(s, `/income/${income.body.id}`))
      .set(auth(s.admin));
    const after = await h.http().get(url(s, '/finance/report')).set(auth(s.admin));
    expect(after.body.income.totalPaise).toBe(250_000);
  });

  it('pins the year report numbers across months, kinds, categories and years', async () => {
    const s = await societyWithResident(h, 'x-pin');
    const other = await societyWithResident(h, 'x-pin-other');
    const [f101, f102] = [s.flats[0]?.id, s.flats[1]?.id];
    // Last financial year: every date in it is in the past whatever today is.
    const start = Number(fyLabel(TODAY, 4).slice(0, 4)) - 1;
    const fy = `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
    const d = (month: number, day: number) =>
      `${month >= 4 ? start : start + 1}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const pay = (
      soc: SocietyFixture,
      flatId: string | undefined,
      amountPaise: number,
      paidOn: string,
    ) =>
      h
        .http()
        .post(url(soc, '/maintenance/payments'))
        .set(auth(soc.admin))
        .send({ flatId, amountPaise, paidOn, method: 'UPI', idempotencyKey: newId() });
    const earn = (kind: string, amountPaise: number, receivedOn: string) =>
      h.http().post(url(s, '/income')).set(auth(s.admin)).send({ kind, amountPaise, receivedOn });

    const mistake = await pay(s, f101, 50_000, d(6, 1));
    await h
      .http()
      .post(url(s, `/maintenance/payments/${mistake.body.id}/reverse`))
      .set(auth(s.admin))
      .send({ reason: 'Typed twice' });
    await pay(s, f101, 250_000, d(4, 10));
    await pay(s, f101, 250_000, d(5, 10));
    await pay(s, f101, 100_000, d(2, 1));
    await pay(s, f102, 75_000, d(4, 20));
    await pay(s, f102, 99_999, TODAY); // this year
    await pay(other, other.flats[0]?.id, 777_000, d(4, 10)); // another society
    await earn('HALL_BOOKING', 100_000, d(4, 15));
    await earn('HALL_BOOKING', 20_000, d(7, 1));
    await earn('INTEREST', 5_000, d(3, 31));
    const electricity = await categoryId(s, 'electricity');
    await spend(s, s.admin, { categoryId: electricity, amountPaise: 120_000, incurredOn: d(4, 5) });
    await spend(s, s.admin, { categoryId: electricity, amountPaise: 80_000, incurredOn: d(5, 5) });
    await spend(s, s.admin, {
      categoryId: await categoryId(s, 'water'),
      amountPaise: 30_000,
      incurredOn: d(5, 6),
    });
    await spend(s, s.admin, {
      categoryId: await categoryId(s, 'lift'),
      amountPaise: 1_800_000,
      incurredOn: d(8, 1),
    }); // waits for approval
    await spend(s, s.admin, { categoryId: electricity, amountPaise: 11_111 }); // this year
    // Bills last: advance pays them. Flat 101 is covered, flat 102 owes 300,000 - 174,999.
    await h
      .http()
      .post(url(s, '/maintenance/bills/adhoc'))
      .set(auth(s.admin))
      .send({ title: 'Repair fund', amountPaise: 300_000, dueDate: d(3, 31) });

    const report = await h
      .http()
      .get(url(s, `/finance/report?fy=${fy}`))
      .set(auth(s.admin));
    expect(report.status).toBe(200);
    const body = report.body;
    expect(body.financialYear).toBe(fy);
    expect(body.years).toEqual([fyLabel(TODAY, 4), fy]);
    expect(body.income).toEqual({
      maintenancePaise: 675_000,
      byKind: [
        { kind: 'HALL_BOOKING', amountPaise: 120_000 },
        { kind: 'INTEREST', amountPaise: 5_000 },
      ],
      totalPaise: 800_000,
    });
    expect(body.expenses.totalPaise).toBe(230_000);
    expect(
      body.expenses.byCategory.map(
        (c: { category: { key: string }; amountPaise: number; count: number }) => [
          c.category.key,
          c.amountPaise,
          c.count,
        ],
      ),
    ).toEqual([
      ['electricity', 200_000, 2],
      ['water', 30_000, 1],
    ]);
    expect(body.netPaise).toBe(570_000);
    expect(body.pending).toEqual({ count: 1, amountPaise: 1_800_000 });
    expect(body.outstandingDuesPaise).toBe(125_001);
    const m = (month: number) => d(month, 1).slice(0, 7);
    const zero = { incomePaise: 0, expensePaise: 0 };
    expect(body.months).toEqual([
      { month: m(4), incomePaise: 425_000, expensePaise: 120_000 },
      { month: m(5), incomePaise: 250_000, expensePaise: 110_000 },
      { month: m(6), ...zero },
      { month: m(7), incomePaise: 20_000, expensePaise: 0 },
      { month: m(8), ...zero },
      { month: m(9), ...zero },
      { month: m(10), ...zero },
      { month: m(11), ...zero },
      { month: m(12), ...zero },
      { month: m(1), ...zero },
      { month: m(2), incomePaise: 100_000, expensePaise: 0 },
      { month: m(3), incomePaise: 5_000, expensePaise: 0 },
    ]);
  });

  it('keeps categories: seeded ones, new ones, and no removal while in use', async () => {
    const s = await societyWithResident(h, 'x5');
    const base = url(s, '/expenses/categories');
    const seeded = await h.http().get(base).set(auth(s.resident.token));
    expect(seeded.body).toHaveLength(10);
    const garden = await h
      .http()
      .post(base)
      .set(auth(s.admin))
      .send({ name: 'Garden', icon: 'lamp' });
    expect(garden.status).toBe(201);
    expect((await h.http().post(base).set(auth(s.admin)).send({ name: 'Garden' })).status).toBe(
      409,
    );
    expect(
      (await h.http().post(base).set(auth(s.resident.token)).send({ name: 'Mine' })).status,
    ).toBe(403);
    await spend(s, s.admin, { categoryId: garden.body.id });
    const busy = await h.http().delete(`${base}/${garden.body.id}`).set(auth(s.admin));
    expect(busy.status).toBe(409);
    expect(busy.body.code).toBe('CATEGORY_NOT_EMPTY');
    const renamed = await h
      .http()
      .patch(`${base}/${await categoryId(s, 'other')}`)
      .set(auth(s.admin))
      .send({ name: 'Misc' });
    expect(renamed.body).toMatchObject({ name: 'Misc', key: null });
    expect((await h.http().delete(`${base}/${renamed.body.id}`).set(auth(s.admin))).status).toBe(
      200,
    );
  });

  it('never leaks expenses across societies', async () => {
    const a = await societyWithResident(h, 'x6');
    const b = await societyWithResident(h, 'x7');
    const e = await spend(a, a.admin, { categoryId: await categoryId(a, 'water') });
    expect(
      (
        await h
          .http()
          .get(url(b, `/expenses/${e.body.id}`))
          .set(auth(b.admin))
      ).status,
    ).toBe(404);
    const cross = await spend(b, b.admin, { categoryId: await categoryId(a, 'water') });
    expect(cross.status).toBe(404);
    expect((await h.http().get(url(b, '/expenses')).set(auth(b.admin))).body.items).toHaveLength(0);
    const report = await h.http().get(url(b, '/finance/report')).set(auth(b.admin));
    expect(report.body.expenses.totalPaise).toBe(0);
  });
});
