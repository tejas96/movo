import type { RingSegment } from '@movo/design-system';

/**
 * The twelve months of the society's financial year for the Home dues ring.
 * A month with an open monthly bill is `due`; any other month up to this one is `paid`; later
 * months are `empty`. When money is owed but no open bill is a plain month (quarterly, yearly,
 * one-off), this month shows as `due`, so the ring never looks fully paid while dues are open.
 */
export function ringMonths(
  fyStartMonth: number,
  openPeriodKeys: readonly (string | null)[],
  owes: boolean,
  now: Date = new Date(),
): RingSegment[] {
  const month = now.getMonth() + 1;
  const startYear = month >= fyStartMonth ? now.getFullYear() : now.getFullYear() - 1;
  const current = (month - fyStartMonth + 12) % 12;
  const open = new Set(openPeriodKeys.filter((k): k is string => Boolean(k)));
  const segments = Array.from({ length: 12 }, (_, i): RingSegment => {
    const m = ((fyStartMonth - 1 + i) % 12) + 1;
    const y = startYear + (fyStartMonth - 1 + i >= 12 ? 1 : 0);
    if (open.has(`${y}-${String(m).padStart(2, '0')}`)) return 'due';
    return i <= current ? 'paid' : 'empty';
  });
  if (owes && !segments.includes('due')) segments[current] = 'due';
  return segments;
}

/** Initials for an avatar: the first letters of the first two words. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}
