import { describe, expect, it } from 'vitest';
import { periodEnd, periodIndexFor, periodStart, rotate } from './rotation';

describe('periods', () => {
  const monthly = { startDate: '2026-10-01', unit: 'MONTH' as const, length: 1 };
  it('monthly periods follow calendar months', () => {
    expect(periodStart(monthly, 0)).toBe('2026-10-01');
    expect(periodEnd(monthly, 0)).toBe('2026-10-31');
    expect(periodStart(monthly, 3)).toBe('2027-01-01');
    expect(periodEnd(monthly, 4)).toBe('2027-02-28');
  });
  it('keeps the day of the month, clamped in short months', () => {
    const c = { startDate: '2026-01-31', unit: 'MONTH' as const, length: 1 };
    expect(periodStart(c, 1)).toBe('2026-02-28');
    expect(periodStart(c, 2)).toBe('2026-03-31');
  });
  it('weekly and daily periods', () => {
    const weekly = { startDate: '2026-10-05', unit: 'WEEK' as const, length: 2 };
    expect(periodStart(weekly, 1)).toBe('2026-10-19');
    expect(periodEnd(weekly, 0)).toBe('2026-10-18');
    const daily = { startDate: '2026-10-05', unit: 'DAY' as const, length: 1 };
    expect(periodEnd(daily, 0)).toBe('2026-10-05');
  });
  it('finds the period for a date', () => {
    expect(periodIndexFor(monthly, '2026-09-30')).toBe(-1);
    expect(periodIndexFor(monthly, '2026-10-31')).toBe(0);
    expect(periodIndexFor(monthly, '2027-03-15')).toBe(5);
    const q = { startDate: '2026-10-15', unit: 'MONTH' as const, length: 3 };
    expect(periodIndexFor(q, '2027-01-14')).toBe(0);
    expect(periodIndexFor(q, '2027-01-15')).toBe(1);
    const weekly = { startDate: '2026-10-05', unit: 'WEEK' as const, length: 1 };
    expect(periodIndexFor(weekly, '2026-10-12')).toBe(1);
  });
});

describe('rotate', () => {
  it('continues after the last person, wrapping round', () => {
    expect(rotate(['a', 'b', 'c'], null, 4)).toEqual(['a', 'b', 'c', 'a']);
    expect(rotate(['a', 'b', 'c'], 'b', 3)).toEqual(['c', 'a', 'b']);
  });
  it('starts again at the top when the last person left the list', () => {
    expect(rotate(['a', 'c'], 'b', 2)).toEqual(['a', 'c']);
    expect(rotate([], 'a', 2)).toEqual([]);
  });
});
