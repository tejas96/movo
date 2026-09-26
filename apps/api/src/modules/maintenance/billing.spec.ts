import { describe, expect, it } from 'vitest';
import {
  allocate,
  amountFor,
  billStatus,
  diffDays,
  fyLabel,
  lateFeeFor,
  openedDuesReminders,
  periodFor,
  periodsToGenerate,
  todayIn,
} from './billing';

describe('periodFor', () => {
  it('monthly periods are calendar months', () => {
    expect(periodFor('MONTHLY', '2026-10-17', 4, 10)).toEqual({
      key: '2026-10',
      start: '2026-10-01',
      end: '2026-10-31',
      dueDate: '2026-10-10',
    });
  });
  it('quarters line up with an April financial year', () => {
    expect(periodFor('QUARTERLY', '2026-05-02', 4, 5)).toMatchObject({
      key: '2026-27-Q1',
      start: '2026-04-01',
      end: '2026-06-30',
      dueDate: '2026-04-05',
    });
    expect(periodFor('QUARTERLY', '2027-02-10', 4, 5)).toMatchObject({
      key: '2026-27-Q4',
      start: '2027-01-01',
      end: '2027-03-31',
    });
  });
  it('half years and years', () => {
    expect(periodFor('HALF_YEARLY', '2026-11-01', 4, 1).key).toBe('2026-27-H2');
    expect(periodFor('YEARLY', '2027-03-31', 4, 15)).toMatchObject({
      key: '2026-27',
      start: '2026-04-01',
      end: '2027-03-31',
      dueDate: '2026-04-15',
    });
  });
  it('keeps the due day inside short months', () => {
    expect(periodFor('MONTHLY', '2027-02-03', 4, 28).dueDate).toBe('2027-02-28');
  });
});

describe('periodsToGenerate', () => {
  const plan = {
    frequency: 'MONTHLY' as const,
    dueDay: 10,
    generateDaysBefore: 7,
    activeFrom: '2026-09-01',
    activeTo: null,
  };
  it('makes the current bill once its day comes', () => {
    // Due on the 10th, made 7 days before: the October bill appears on 3 October.
    expect(periodsToGenerate(plan, '2026-10-02', 4).map((p) => p.key)).toEqual([]);
    expect(periodsToGenerate(plan, '2026-10-03', 4).map((p) => p.key)).toEqual(['2026-10']);
    expect(periodsToGenerate(plan, '2026-10-25', 4).map((p) => p.key)).toEqual(['2026-10']);
  });
  it('makes next month early when the lead time crosses the month end', () => {
    const early = { ...plan, dueDay: 1 };
    expect(periodsToGenerate(early, '2026-10-25', 4).map((p) => p.key)).toEqual([
      '2026-10',
      '2026-11',
    ]);
  });
  it('never back-fills before the start', () => {
    expect(periodsToGenerate({ ...plan, activeFrom: '2026-11-01' }, '2026-10-05', 4)).toEqual([]);
  });
  it('stops after the end date', () => {
    expect(
      periodsToGenerate({ ...plan, dueDay: 1, activeTo: '2026-10-31' }, '2026-10-25', 4),
    ).toHaveLength(1);
  });
});

describe('amounts and fees', () => {
  it('flat rate, per square foot and overrides', () => {
    expect(amountFor('FLAT_RATE', 250_000, { areaSqft: null }, undefined)).toBe(250_000);
    expect(amountFor('PER_SQFT', 350, { areaSqft: 850 }, undefined)).toBe(297_500);
    expect(amountFor('PER_SQFT', 350, { areaSqft: null }, undefined)).toBeNull();
    expect(amountFor('PER_SQFT', 350, { areaSqft: null }, 100_000)).toBe(100_000);
  });
  it('late fees start after the grace days and respect the cap', () => {
    const due = '2026-10-10';
    expect(lateFeeFor({ type: 'NONE' }, 250_000, due, '2026-12-01')).toBe(0);
    const fixed = { type: 'FIXED', amountPaise: 10_000, graceDays: 5 } as const;
    expect(lateFeeFor(fixed, 250_000, due, '2026-10-15')).toBe(0);
    expect(lateFeeFor(fixed, 250_000, due, '2026-10-16')).toBe(10_000);
    const pct = { type: 'PERCENT', basisPoints: 200, graceDays: 0, capPaise: null } as const;
    expect(lateFeeFor(pct, 250_000, due, '2026-10-11')).toBe(5_000);
    const daily = { type: 'PER_DAY', amountPaise: 1_000, graceDays: 2, capPaise: 5_000 } as const;
    expect(lateFeeFor(daily, 250_000, due, '2026-10-14')).toBe(2_000);
    expect(lateFeeFor(daily, 250_000, due, '2026-11-30')).toBe(5_000);
  });
});

describe('status, allocation, reminders', () => {
  it('derives the bill status', () => {
    const b = { totalPaise: 100, paidPaise: 0, dueDate: '2026-10-10', waived: false };
    expect(billStatus(b, '2026-10-10')).toBe('DUE');
    expect(billStatus({ ...b, paidPaise: 40 }, '2026-10-01')).toBe('PARTIALLY_PAID');
    expect(billStatus({ ...b, paidPaise: 40 }, '2026-10-11')).toBe('OVERDUE');
    expect(billStatus({ ...b, paidPaise: 100 }, '2026-12-01')).toBe('PAID');
    expect(billStatus({ ...b, waived: true }, '2026-12-01')).toBe('WAIVED');
  });
  it('pays bills in order and keeps the rest as advance', () => {
    const bills = [
      { id: 'a', outstandingPaise: 100 },
      { id: 'b', outstandingPaise: 0 },
      { id: 'c', outstandingPaise: 100 },
    ];
    expect(allocate(150, bills)).toEqual({
      allocations: [
        { billId: 'a', amountPaise: 100 },
        { billId: 'c', amountPaise: 50 },
      ],
      remainderPaise: 0,
    });
    expect(allocate(250, bills).remainderPaise).toBe(50);
  });
  it('opens dues reminders over time', () => {
    expect(openedDuesReminders('2026-10-10', '2026-10-06')).toEqual([]);
    expect(openedDuesReminders('2026-10-10', '2026-10-07')).toEqual(['before-3d']);
    expect(openedDuesReminders('2026-10-10', '2026-10-24')).toEqual([
      'before-3d',
      'due-day',
      'overdue-w1',
      'overdue-w2',
    ]);
    expect(openedDuesReminders('2026-10-10', '2027-01-01')).toHaveLength(6);
  });
  it('dates and years', () => {
    expect(diffDays('2026-11-01', '2026-10-30')).toBe(2);
    expect(fyLabel('2027-03-31', 4)).toBe('2026-27');
    expect(fyLabel('2026-04-01', 4)).toBe('2026-27');
    expect(todayIn('Asia/Kolkata', new Date('2026-10-09T19:00:00Z'))).toBe('2026-10-10');
  });
});
