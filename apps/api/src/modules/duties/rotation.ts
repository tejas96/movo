import type { DutyPeriodUnit } from '@movo/contracts';
import { addDays, diffDays, fmt, ymd } from '../maintenance/billing';

/** Pure rotation rules. Dates are ISO calendar dates in the society's time zone. */

export interface Cadence {
  startDate: string;
  unit: DutyPeriodUnit;
  length: number;
}

/** How many turns are kept planned ahead of today, including the current one. */
export const PLAN_AHEAD = 12;

function addMonthsKeepDay(date: string, months: number): string {
  const { y, m, d } = ymd(date);
  const i = y * 12 + (m - 1) + months;
  const ny = Math.floor(i / 12);
  const nm = (i % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return fmt({ y: ny, m: nm, d: Math.min(d, last) });
}

/** First day of period `index` (0 = the start date). */
export function periodStart(c: Cadence, index: number): string {
  if (c.unit === 'DAY') return addDays(c.startDate, index * c.length);
  if (c.unit === 'WEEK') return addDays(c.startDate, index * c.length * 7);
  return addMonthsKeepDay(c.startDate, index * c.length);
}

/** Last day of period `index`, inclusive. */
export function periodEnd(c: Cadence, index: number): string {
  return addDays(periodStart(c, index + 1), -1);
}

/** The period that contains `date`, or -1 before the start. */
export function periodIndexFor(c: Cadence, date: string): number {
  if (date < c.startDate) return -1;
  if (c.unit !== 'MONTH') {
    const days = c.unit === 'DAY' ? c.length : c.length * 7;
    return Math.floor(diffDays(date, c.startDate) / days);
  }
  // Months vary in length: estimate, then step to the right period.
  const a = ymd(c.startDate);
  const b = ymd(date);
  let i = Math.max(0, Math.floor(((b.y - a.y) * 12 + (b.m - a.m)) / c.length));
  while (i > 0 && periodStart(c, i) > date) i -= 1;
  while (periodStart(c, i + 1) <= date) i += 1;
  return i;
}

/**
 * The next `count` participants in order, starting after `after` (or at the first one when
 * `after` is null or no longer in the list).
 */
export function rotate(participants: readonly string[], after: string | null, count: number) {
  if (participants.length === 0) return [];
  const at = after === null ? -1 : participants.indexOf(after);
  return Array.from(
    { length: count },
    (_, i) => participants[(at + 1 + i) % participants.length] as string,
  );
}
