import type { Timeframe } from '@movo/contracts';
import { ApiException } from '../../common/errors/api.exception';
import { hours, minutes } from '../../common/util/dates';
import { decodeCursor, encodeCursor } from '../../common/util/pagination';

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

const WINDOW = 150;

/**
 * Keyset pages over (startsAt, id): ascending for UPCOMING, descending for PAST. Rows are
 * filtered by audience after the query, so it reads a window and keeps what the viewer may see.
 */
export async function pageByStart<T extends Timed>(opts: {
  when: Timeframe;
  cursor: string | undefined;
  limit: number;
  fetch: (args: {
    cursorWhere: Record<string, unknown>;
    orderBy: [{ startsAt: 'asc' | 'desc' }, { id: 'asc' | 'desc' }];
    take: number;
  }) => Promise<T[]>;
  visible: (row: T) => boolean;
}): Promise<{ items: T[]; nextCursor: string | null }> {
  const dir = opts.when === 'UPCOMING' ? 'asc' : 'desc';
  const op = dir === 'asc' ? 'gt' : 'lt';
  const cursor = decodeCursor(opts.cursor);
  const cursorWhere = cursor
    ? {
        OR: [{ startsAt: { [op]: cursor.at } }, { startsAt: cursor.at, id: { [op]: cursor.id } }],
      }
    : {};
  const rows = await opts.fetch({
    cursorWhere,
    orderBy: [{ startsAt: dir }, { id: dir }],
    take: WINDOW,
  });
  const visible = rows.filter(opts.visible);
  const items = visible.slice(0, opts.limit);
  const last = items[items.length - 1];
  const hasMore = visible.length > opts.limit || rows.length === WINDOW;
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor({ at: last.startsAt, id: last.id }) : null,
  };
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
