import type { AmountRule, BillingFrequency, BillStatus, LateFeeRule } from '@movo/contracts';

/**
 * Pure billing rules. Dates are ISO calendar dates ("2026-10-10") in the society's time zone,
 * so no clock or time zone logic leaks in here.
 */

const MONTHS: Record<BillingFrequency, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
};

export interface Period {
  key: string;
  /** First and last day, inclusive. */
  start: string;
  end: string;
  dueDate: string;
}

interface Ymd {
  y: number;
  m: number;
  d: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (s: string): Ymd => {
  const [y, m, d] = s.split('-').map(Number);
  return { y: y ?? 0, m: m ?? 1, d: d ?? 1 };
};
export const fmt = ({ y, m, d }: Ymd): string => `${y}-${pad(m)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Adds whole months to a (year, month), keeping month in 1..12. */
function addMonths(y: number, m: number, n: number): { y: number; m: number } {
  const i = y * 12 + (m - 1) + n;
  return { y: Math.floor(i / 12), m: (i % 12) + 1 };
}

export function addDays(date: string, n: number): string {
  const { y, m, d } = ymd(date);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return fmt({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

export function diffDays(a: string, b: string): number {
  const A = ymd(a);
  const B = ymd(b);
  return Math.round((Date.UTC(A.y, A.m - 1, A.d) - Date.UTC(B.y, B.m - 1, B.d)) / 86_400_000);
}

/** "2026-27" for a date, given the month the financial year starts (4 = April). */
export function fyLabel(date: string, fyStartMonth: number): string {
  const { y, m } = ymd(date);
  const start = m >= fyStartMonth ? y : y - 1;
  return fyStartMonth === 1 ? String(start) : `${start}-${pad((start + 1) % 100)}`;
}

/** The billing period that contains `date`. Longer periods line up with the financial year. */
export function periodFor(
  frequency: BillingFrequency,
  date: string,
  fyStartMonth: number,
  dueDay: number,
): Period {
  const { y, m } = ymd(date);
  const len = MONTHS[frequency];
  let startYm: { y: number; m: number };
  let key: string;
  if (frequency === 'MONTHLY') {
    startYm = { y, m };
    key = `${y}-${pad(m)}`;
  } else {
    const offset = (m - fyStartMonth + 12) % 12;
    const index = Math.floor(offset / len);
    startYm = addMonths(y, m, -offset + index * len);
    const fy = fyLabel(date, fyStartMonth);
    key =
      frequency === 'YEARLY' ? fy : `${fy}-${frequency === 'QUARTERLY' ? 'Q' : 'H'}${index + 1}`;
  }
  const endYm = addMonths(startYm.y, startYm.m, len - 1);
  return {
    key,
    start: fmt({ ...startYm, d: 1 }),
    end: fmt({ ...endYm, d: daysIn(endYm.y, endYm.m) }),
    dueDate: fmt({ ...startYm, d: Math.min(dueDay, daysIn(startYm.y, startYm.m)) }),
  };
}

export interface PlanRule {
  frequency: BillingFrequency;
  dueDay: number;
  generateDaysBefore: number;
  activeFrom: string;
  activeTo: string | null;
}

/**
 * Periods whose bills should exist by `today`: the current one and the next one, each once its
 * generation day (due date minus generateDaysBefore) has come. Periods before the plan started
 * are never back-filled.
 */
export function periodsToGenerate(plan: PlanRule, today: string, fyStartMonth: number): Period[] {
  const current = periodFor(plan.frequency, today, fyStartMonth, plan.dueDay);
  const next = periodFor(plan.frequency, addDays(current.end, 1), fyStartMonth, plan.dueDay);
  return [current, next].filter(
    (p) =>
      addDays(p.dueDate, -plan.generateDaysBefore) <= today &&
      p.end >= plan.activeFrom &&
      (plan.activeTo === null || p.start <= plan.activeTo),
  );
}

/** Amount for one flat, or null when the rule needs data the flat does not have. */
export function amountFor(
  rule: AmountRule,
  amountPaise: number,
  flat: { areaSqft: number | null },
  overridePaise: number | undefined,
): number | null {
  if (overridePaise !== undefined) return overridePaise;
  if (rule === 'FLAT_RATE') return amountPaise;
  if (!flat.areaSqft) return null;
  return Math.round(amountPaise * flat.areaSqft);
}

export function lateFeeFor(
  rule: LateFeeRule,
  basePaise: number,
  dueDate: string,
  today: string,
): number {
  if (rule.type === 'NONE') return 0;
  const daysLate = diffDays(today, dueDate) - rule.graceDays;
  if (daysLate <= 0) return 0;
  const cap = (n: number, c: number | null) => (c === null ? n : Math.min(n, c));
  switch (rule.type) {
    case 'FIXED':
      return rule.amountPaise;
    case 'PERCENT':
      return cap(Math.round((basePaise * rule.basisPoints) / 10_000), rule.capPaise);
    case 'PER_DAY':
      return cap(daysLate * rule.amountPaise, rule.capPaise);
  }
}

export function billStatus(
  bill: { totalPaise: number; paidPaise: number; dueDate: string; waived: boolean },
  today: string,
): BillStatus {
  if (bill.waived) return 'WAIVED';
  if (bill.paidPaise >= bill.totalPaise) return 'PAID';
  if (today > bill.dueDate) return 'OVERDUE';
  return bill.paidPaise > 0 ? 'PARTIALLY_PAID' : 'DUE';
}

/** Splits money across bills in the order given. Whatever is left over is advance. */
export function allocate(
  amountPaise: number,
  bills: readonly { id: string; outstandingPaise: number }[],
): { allocations: { billId: string; amountPaise: number }[]; remainderPaise: number } {
  let left = amountPaise;
  const allocations: { billId: string; amountPaise: number }[] = [];
  for (const b of bills) {
    if (left <= 0) break;
    const take = Math.min(left, b.outstandingPaise);
    if (take <= 0) continue;
    allocations.push({ billId: b.id, amountPaise: take });
    left -= take;
  }
  return { allocations, remainderPaise: left };
}

/**
 * Dues reminder kinds that have come by `today`, oldest first: 3 days before, on the due date,
 * then weekly while overdue (at most 4).
 */
export function openedDuesReminders(dueDate: string, today: string): string[] {
  const kinds: string[] = [];
  if (today >= addDays(dueDate, -3)) kinds.push('before-3d');
  if (today >= dueDate) kinds.push('due-day');
  for (let w = 1; w <= 4; w += 1) if (today >= addDays(dueDate, 7 * w)) kinds.push(`overdue-w${w}`);
  return kinds;
}

/** Receipt number like R-2026-27-0007. */
export const receiptNo = (fy: string, n: number): string => `R-${fy}-${String(n).padStart(4, '0')}`;

/** Today's date in a time zone, as YYYY-MM-DD. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
