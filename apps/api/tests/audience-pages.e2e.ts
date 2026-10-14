import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auth, type SocietyFixture, societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const url = (s: SocietyFixture, rest: string) => `/v1/societies/${s.societyId}${rest}`;
const HIDDEN = 160;

/** The committee role: the resident does not hold it, so ROLES rows for it are not theirs. */
async function committeeOnly(s: SocietyFixture) {
  const role = await h.prisma.role.findFirstOrThrow({
    where: { societyId: s.societyId, key: 'committee' },
  });
  return { type: 'ROLES', ids: [role.id] };
}

async function pages(s: SocietyFixture, path: string, limit: number) {
  const ids: string[][] = [];
  let cursor: string | null = null;
  do {
    const query = `${path.includes('?') ? '&' : '?'}limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`;
    const res: { status: number; body: { items: { id: string }[]; nextCursor: string | null } } =
      await h
        .http()
        .get(url(s, `${path}${query}`))
        .set(auth(s.resident.token));
    expect(res.status).toBe(200);
    ids.push(res.body.items.map((i) => i.id));
    cursor = res.body.nextCursor;
  } while (cursor && ids.length < 10);
  return ids;
}

describe('audience filter in SQL', () => {
  it('fills a notices page even behind many notices the member may not see', async () => {
    const s = await societyWithResident(h, 'aud-n');
    const hidden = await committeeOnly(s);
    const now = Date.now();
    const row = (i: number, audience: object) => ({
      societyId: s.societyId,
      title: `Notice ${i}`,
      body: 'Body',
      audience,
      status: 'PUBLISHED' as const,
      publishedAt: new Date(now - i * 60_000),
      createdByMembershipId: s.adminMembershipId,
    });
    // Newest first: HIDDEN committee-only notices, then three for everyone.
    await h.prisma.notice.createMany({
      data: [
        ...Array.from({ length: HIDDEN }, (_, i) => row(i + 1, hidden)),
        ...[1, 2, 3].map((i) => row(HIDDEN + i, { type: 'ALL' })),
      ],
    });
    const got = await pages(s, '/notices', 2);
    expect(got.map((p) => p.length)).toEqual([2, 1]);
  });

  it('fills meeting and event pages the same way', async () => {
    const s = await societyWithResident(h, 'aud-m');
    const hidden = await committeeOnly(s);
    const soon = (i: number) => new Date(Date.now() + 86_400_000 + i * 60_000);
    const meeting = (i: number, audience: object) => ({
      societyId: s.societyId,
      title: `Meeting ${i}`,
      startsAt: soon(i),
      audience,
      createdByMembershipId: s.adminMembershipId,
    });
    // Soonest first: HIDDEN committee-only items, then three for everyone.
    await h.prisma.meeting.createMany({
      data: [
        ...Array.from({ length: HIDDEN }, (_, i) => meeting(i, hidden)),
        ...[1, 2, 3].map((i) => meeting(HIDDEN + i, { type: 'ALL' })),
      ],
    });
    await h.prisma.societyEvent.createMany({
      data: [
        ...Array.from({ length: HIDDEN }, (_, i) => meeting(i, hidden)),
        ...[1, 2, 3].map((i) => meeting(HIDDEN + i, { type: 'ALL' })),
      ],
    });
    expect((await pages(s, '/meetings?when=UPCOMING', 2)).map((p) => p.length)).toEqual([2, 1]);
    expect((await pages(s, '/events?when=UPCOMING', 2)).map((p) => p.length)).toEqual([2, 1]);

    // The committee still sees every item.
    const all = await h.http().get(url(s, '/meetings?when=UPCOMING&limit=50')).set(auth(s.admin));
    expect(all.body.items).toHaveLength(50);
  });
});
