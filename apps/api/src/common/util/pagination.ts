/** Opaque cursor = base64url("<iso date>|<id>"). Lists sort by (date desc, id desc) unless noted. */
export interface Cursor {
  at: Date;
  id: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.at.toISOString()}|${c.id}`).toString('base64url');
}

export function decodeCursor(raw: string | undefined): Cursor | undefined {
  if (!raw) return undefined;
  try {
    const [at, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
    if (!at || !id) return undefined;
    const date = new Date(at);
    return Number.isNaN(date.getTime()) ? undefined : { at: date, id };
  } catch {
    return undefined;
  }
}

/**
 * Where-clause for the rows after `cursor` in (field, id) order: `{ OR: [...] }`, or `{}` on
 * the first page. Spread it into a where, or put it in an AND when the where has its own OR.
 */
export function afterCursor(
  cursor: Cursor | undefined,
  field = 'createdAt',
  dir: 'asc' | 'desc' = 'desc',
): object {
  if (!cursor) return {};
  const op = dir === 'asc' ? 'gt' : 'lt';
  return {
    OR: [{ [field]: { [op]: cursor.at } }, { [field]: cursor.at, id: { [op]: cursor.id } }],
  };
}

/**
 * Takes limit+1 rows and returns the page plus the next cursor. `at` picks the sort date
 * (createdAt by default). Lists that read a fixed window pass their own `hasMore`.
 */
export function slicePage<T extends { createdAt: Date; id: string }>(
  rows: T[],
  limit: number,
): Page<T>;
export function slicePage<T extends { id: string }>(
  rows: T[],
  limit: number,
  at: (row: T) => Date,
  hasMore?: boolean,
): Page<T>;
export function slicePage<T extends { id: string; createdAt?: Date }>(
  rows: T[],
  limit: number,
  at: (row: T) => Date = (row) => row.createdAt as Date,
  hasMore = rows.length > limit,
): Page<T> {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeCursor({ at: at(last), id: last.id }) : null;
  return { items, nextCursor };
}
