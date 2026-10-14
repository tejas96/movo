import type { Timeframe } from '@movo/contracts';
import { ApiException } from '../../common/errors/api.exception';
import { hours, minutes } from '../../common/util/dates';
import { afterCursor, decodeCursor, slicePage } from '../../common/util/pagination';

/** A meeting or event with no end time counts as running for this long after it starts. */
export const OPEN_ENDED_MS = hours(2);

/** Home shows meetings and events that start within this many days. */
export const UPCOMING_DAYS = 14;

interface Timed {
  id: string;
  startsAt: Date;
  endsAt: Date | null;
}

/** Prisma where for items that are not over yet. */
export function notOverWhere(now: Date) {
  return {
    OR: [
      { endsAt: { gt: now } },
      { endsAt: null, startsAt: { gt: new Date(now.getTime() - OPEN_ENDED_MS) } },
    ],
  };
}

/** Prisma where for items that are over. */
export function overWhere(now: Date) {
  return {
    OR: [
      { endsAt: { lte: now } },
      { endsAt: null, startsAt: { lte: new Date(now.getTime() - OPEN_ENDED_MS) } },
    ],
  };
}

export function isOver(item: Omit<Timed, 'id'>, now: Date): boolean {
  if (item.endsAt) return item.endsAt.getTime() <= now.getTime();
  return item.startsAt.getTime() + OPEN_ENDED_MS <= now.getTime();
}

/**
 * Keyset pages over (startsAt, id): ascending for UPCOMING, descending for PAST. The caller's
 * fetch filters by audience in SQL, so limit+1 rows are enough.
 */
export async function pageByStart<T extends Timed>(opts: {
  when: Timeframe;
  cursor: string | undefined;
  limit: number;
  fetch: (args: {
    cursorWhere: object;
    orderBy: [{ startsAt: 'asc' | 'desc' }, { id: 'asc' | 'desc' }];
    take: number;
  }) => Promise<T[]>;
}): Promise<{ items: T[]; nextCursor: string | null }> {
  const dir = opts.when === 'UPCOMING' ? 'asc' : 'desc';
  const cursorWhere = afterCursor(decodeCursor(opts.cursor), 'startsAt', dir);
  const rows = await opts.fetch({
    cursorWhere,
    orderBy: [{ startsAt: dir }, { id: dir }],
    take: opts.limit + 1,
  });
  return slicePage(rows, opts.limit, (r) => r.startsAt);
}

/** Reminder kinds are stored as "before-24h". */
export const reminderKind = (h: number): string => `before-${h}h`;

/**
 * Which reminder windows (hours before the start) have opened by `now`, smallest first.
 * The smallest one is the reminder to send; larger ones are marked sent with it so a
 * member never gets "tomorrow" and "in 1 hour" in the same run.
 */
export function dueWindows(startsAt: Date, now: Date, windows: readonly number[]): number[] {
  const left = startsAt.getTime() - now.getTime();
  if (left <= 0) return [];
  return [...new Set(windows)].filter((h) => left <= hours(h)).sort((a, b) => a - b);
}

/** Clock skew allowance when checking that a new start time is in the future. */
const SKEW_MS = minutes(2);

/** New start times must be in the future; an end time must follow the start. */
export function assertTimes(startsAt: Date, endsAt: Date | null, mustBeFuture: boolean): void {
  if (mustBeFuture && startsAt.getTime() < Date.now() - SKEW_MS)
    throw ApiException.validation([
      { path: ['startsAt'], message: 'Must be in the future', in: 'body' },
    ]);
  if (endsAt && endsAt.getTime() <= startsAt.getTime())
    throw ApiException.validation([
      { path: ['endsAt'], message: 'Must be after the start', in: 'body' },
    ]);
}
