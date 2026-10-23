import { describe, expect, it } from 'vitest';
import { initialsOf, ringMonths } from './dues-ring';

// 23 Oct 2026; the financial year starts in April, so October is month index 6.
const oct = new Date(2026, 9, 23);

describe('ringMonths', () => {
  it('fills April to October and leaves the rest empty when nothing is open', () => {
    const r = ringMonths(4, [], false, oct);
    expect(r.slice(0, 7)).toEqual(Array(7).fill('paid'));
    expect(r.slice(7)).toEqual(Array(5).fill('empty'));
  });

  it('marks months with open monthly bills as due', () => {
    const r = ringMonths(4, ['2026-09', '2026-10'], true, oct);
    expect(r[5]).toBe('due');
    expect(r[6]).toBe('due');
    expect(r[4]).toBe('paid');
  });

  it('maps next-year months of the financial year', () => {
    const feb = new Date(2027, 1, 10);
    const r = ringMonths(4, ['2027-01'], true, feb);
    expect(r[9]).toBe('due');
    expect(r[10]).toBe('paid');
    expect(r[11]).toBe('empty');
  });

  it('shows this month as due when money is owed on a non-monthly bill', () => {
    const r = ringMonths(4, ['2026-27-Q2', null], true, oct);
    expect(r[6]).toBe('due');
  });

  it('works for a January financial year', () => {
    const r = ringMonths(1, [], false, oct);
    expect(r.filter((s) => s === 'paid')).toHaveLength(10);
  });
});

describe('initialsOf', () => {
  it('takes the first letters of two words', () => {
    expect(initialsOf('anita sharma')).toBe('AS');
    expect(initialsOf('  Rao ')).toBe('R');
    expect(initialsOf('Meera Kulkarni Joshi')).toBe('MK');
  });
});
