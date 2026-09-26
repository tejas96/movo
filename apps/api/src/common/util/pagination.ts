/** Opaque cursor = base64url("<iso date>|<id>"). Lists sort by (createdAt desc, id desc). */
export interface Cursor {
  at: Date;
  id: string;
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

/** Takes limit+1 rows and returns the page plus the next cursor. */
export function slicePage<T extends { createdAt: Date; id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  const nextCursor =
    rows.length > limit && last ? encodeCursor({ at: last.createdAt, id: last.id }) : null;
  return { items, nextCursor };
}
