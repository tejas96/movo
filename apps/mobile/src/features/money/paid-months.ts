import type { PaymentSummary } from '@movo/contracts';

export interface PaidMonth {
  /** 1–12. */
  month: number;
  year: number;
  paise: number;
  current: boolean;
}

/**
 * Money paid in each of the last six months, oldest first, for the "What you paid" bars.
 * Reversed payments do not count.
 */
export function paidLastSixMonths(
  payments: readonly Pick<PaymentSummary, 'paidOn' | 'amountPaise' | 'status'>[],
  now: Date = new Date(),
): PaidMonth[] {
  const months: PaidMonth[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear(), paise: 0, current: i === 0 });
  }
  for (const p of payments) {
    if (p.status === 'REVERSED') continue;
    const [y, m] = p.paidOn.split('-').map(Number);
    const slot = months.find((x) => x.year === y && x.month === m);
    if (slot) slot.paise += p.amountPaise;
  }
  return months;
}
