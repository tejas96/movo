import { describe, expect, it } from 'vitest';
import { paidLastSixMonths } from './paid-months';

const now = new Date(2026, 9, 23);

describe('paidLastSixMonths', () => {
  it('lists May to October with this month last', () => {
    const r = paidLastSixMonths([], now);
    expect(r.map((m) => m.month)).toEqual([5, 6, 7, 8, 9, 10]);
    expect(r[5]?.current).toBe(true);
  });

  it('adds payments to their month and skips reversed ones', () => {
    const r = paidLastSixMonths(
      [
        { paidOn: '2026-09-26', amountPaise: 250000, status: 'RECORDED' },
        { paidOn: '2026-09-02', amountPaise: 1000, status: 'RECORDED' },
        { paidOn: '2026-10-01', amountPaise: 5000, status: 'REVERSED' },
        { paidOn: '2025-09-01', amountPaise: 999, status: 'RECORDED' },
      ] as never,
      now,
    );
    expect(r[4]?.paise).toBe(251000);
    expect(r[5]?.paise).toBe(0);
  });

  it('crosses the year end', () => {
    const r = paidLastSixMonths([], new Date(2027, 1, 5));
    expect(r.map((m) => `${m.year}-${m.month}`)).toEqual([
      '2026-9',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-1',
      '2027-2',
    ]);
  });
});
