import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TtlCache } from '../src/common/tenant/tenant-cache';
import { ContextService } from '../src/modules/tenancy/context.service';
import { createHarness, type Harness } from './harness';

let h: Harness;
/** Stands in for a second API instance: its own cache and its own listening connection. */
let other: TtlCache;
beforeAll(async () => {
  h = await createHarness();
  other = new TtlCache(h.app.get(PrismaService));
  await other.onModuleInit();
});
afterAll(async () => {
  await other.onModuleDestroy();
  await h.close();
});

async function eventually(check: () => boolean, ms = 3_000): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return check();
}

describe('cache invalidation across instances', () => {
  it('a logout, suspension or role change on one instance clears the others', async () => {
    const mine = h.app.get(TtlCache);
    other.set('tenant:u1:s1', { kind: 'ok' }, 60_000);
    other.set('tenant:u2:s1', { kind: 'ok' }, 60_000);
    other.set('session:abc', true, 60_000);

    // What MembersService does after a suspension or a role change.
    h.app.get(ContextService).invalidateUser('u1');
    expect(await eventually(() => other.get('tenant:u1:s1') === undefined)).toBe(true);
    expect(other.get('tenant:u2:s1')).toEqual({ kind: 'ok' });

    // What SessionsService does on logout.
    mine.delete('session:abc');
    expect(await eventually(() => other.get('session:abc') === undefined)).toBe(true);
  });

  it('ignores its own messages and keeps entries it did not delete', async () => {
    const mine = h.app.get(TtlCache);
    mine.set('tenant:keep:s1', 1, 60_000);
    other.deleteByPrefix('tenant:gone:');
    await new Promise((r) => setTimeout(r, 200));
    expect(mine.get('tenant:keep:s1')).toBe(1);
  });
});
