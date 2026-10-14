import { describe, expect, it } from 'vitest';
import { afterCursor, decodeCursor, encodeCursor, slicePage } from './pagination';

const at = new Date('2026-10-01T00:00:00.000Z');

describe('pagination', () => {
  it('keeps the cursor format the app sends back: base64url("<iso>|<id>")', () => {
    const raw = encodeCursor({ at, id: 'abc' });
    expect(Buffer.from(raw, 'base64url').toString()).toBe('2026-10-01T00:00:00.000Z|abc');
    expect(decodeCursor(raw)).toEqual({ at, id: 'abc' });
    expect(decodeCursor('not a cursor')).toBeUndefined();
  });

  it('builds the keyset where for any date field and direction', () => {
    expect(afterCursor(undefined)).toEqual({});
    expect(afterCursor({ at, id: 'x' })).toEqual({
      OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: 'x' } }],
    });
    expect(afterCursor({ at, id: 'x' }, 'startsAt', 'asc')).toEqual({
      OR: [{ startsAt: { gt: at } }, { startsAt: at, id: { gt: 'x' } }],
    });
  });

  it('slices limit+1 rows, or a window with its own hasMore, by the chosen date', () => {
    const rows = [1, 2, 3].map((n) => ({ id: `r${n}`, createdAt: at, dueDate: new Date(n) }));
    expect(slicePage(rows, 3).nextCursor).toBeNull();
    const page = slicePage(rows, 2, (r) => r.dueDate);
    expect(page.items.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(page.nextCursor).toBe(encodeCursor({ at: new Date(2), id: 'r2' }));
    expect(slicePage(rows, 3, (r) => r.dueDate, true).nextCursor).toBe(
      encodeCursor({ at: new Date(3), id: 'r3' }),
    );
  });
});
