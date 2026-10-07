import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { newId } from '../src/common/util/ids';
import { todayIn } from '../src/modules/maintenance/billing';
import { auth, type SocietyFixture, societyWithResident } from './fixtures';
import { createHarness, type Harness, TEST_PASSWORD } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const TODAY = todayIn('Asia/Kolkata');
const url = (s: SocietyFixture, rest = '') => `/v1/societies/${s.societyId}${rest}`;
/** Enough of a JPEG for the server's first-bytes check. */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);

async function upload(s: SocietyFixture, token: string, kind?: string): Promise<string> {
  const res = await h
    .http()
    .post(url(s, `/files${kind ? `?kind=${kind}` : ''}`))
    .set(auth(token))
    .attach('file', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
  if (res.status !== 201) throw new Error(`upload: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.id;
}

const fileRows = (ids: string[]) => h.prisma.storedFile.count({ where: { id: { in: ids } } });
const ids = (refs: { id: string }[]) => refs.map((r) => r.id);

describe('photos', () => {
  it('sets, shows, replaces and removes a profile photo', async () => {
    const s = await societyWithResident(h, 'p1');
    const token = s.resident.token;
    const bad = await h
      .http()
      .post('/v1/me/avatar')
      .set(auth(token))
      .attach('file', Buffer.from('not a photo'), 'a.txt');
    expect(bad.status).toBe(400);

    const set = await h
      .http()
      .post('/v1/me/avatar')
      .set(auth(token))
      .attach('file', JPEG, { filename: 'me.jpg', contentType: 'image/jpeg' });
    expect(set.status).toBe(201);
    expect(set.body.avatarUrl).toMatch(/^\/v1\/files\/[0-9a-f-]+\?e=\d+&s=/);
    const photo = await h.http().get(set.body.avatarUrl);
    expect(photo.status).toBe(200);
    expect(photo.headers['content-type']).toBe('image/jpeg');
    const first = await h.prisma.user.findUniqueOrThrow({ where: { id: s.resident.userId } });

    // Neighbours see it in the directory.
    const members = await h.http().get(url(s, '/members')).set(auth(s.admin));
    const card = members.body.items.find((m: { userId: string }) => m.userId === s.resident.userId);
    expect(card.avatarUrl).toMatch(/^\/v1\/files\//);

    // A new photo replaces the old one, bytes and row.
    const again = await h
      .http()
      .post('/v1/me/avatar')
      .set(auth(token))
      .attach('file', JPEG, { filename: 'me2.jpg', contentType: 'image/jpeg' });
    expect(again.body.avatarUrl).not.toBe(set.body.avatarUrl);
    expect(await fileRows([first.avatarFileId as string])).toBe(0);

    const removed = await h.http().delete('/v1/me/avatar').set(auth(token));
    expect(removed.status).toBe(200);
    expect(removed.body.avatarUrl).toBeNull();
    expect(await h.prisma.storedFile.count({ where: { kind: 'AVATAR' } })).toBe(0);
  });

  it('deletes the profile photo with the account', async () => {
    const s = await societyWithResident(h, 'p2');
    await h
      .http()
      .post('/v1/me/avatar')
      .set(auth(s.resident.token))
      .attach('file', JPEG, { filename: 'me.jpg', contentType: 'image/jpeg' });
    expect(await h.prisma.storedFile.count({ where: { kind: 'AVATAR' } })).toBe(1);
    const res = await h
      .http()
      .delete('/v1/me')
      .set(auth(s.resident.token))
      .send({ password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(await h.prisma.storedFile.count({ where: { kind: 'AVATAR' } })).toBe(0);
  });

  it('sets the society logo only from a logo upload by someone who manages the society', async () => {
    const s = await societyWithResident(h, 'p3');
    const listingPhoto = await upload(s, s.admin);
    const wrongKind = await h
      .http()
      .patch(url(s))
      .set(auth(s.admin))
      .send({ logoFileId: listingPhoto });
    expect(wrongKind.status).toBe(404);

    const residentLogo = await upload(s, s.resident.token, 'SOCIETY_LOGO');
    const byResident = await h
      .http()
      .patch(url(s))
      .set(auth(s.resident.token))
      .send({ logoFileId: residentLogo });
    expect(byResident.status).toBe(403);

    const logo = await upload(s, s.admin, 'SOCIETY_LOGO');
    const set = await h.http().patch(url(s)).set(auth(s.admin)).send({ logoFileId: logo });
    expect(set.status).toBe(200);
    expect(set.body.logoUrl).toMatch(/^\/v1\/files\//);
    const ctx = await h.http().get('/v1/me/context').set(auth(s.resident.token));
    expect(ctx.body.memberships[0].society.logoUrl).toMatch(/^\/v1\/files\//);

    const next = await upload(s, s.admin, 'SOCIETY_LOGO');
    await h.http().patch(url(s)).set(auth(s.admin)).send({ logoFileId: next });
    expect(await fileRows([logo])).toBe(0);
    const cleared = await h.http().patch(url(s)).set(auth(s.admin)).send({ logoFileId: null });
    expect(cleared.body.logoUrl).toBeNull();
    expect(await fileRows([next])).toBe(0);
  });

  it('keeps bill photos on an expense and removes the ones taken off', async () => {
    const s = await societyWithResident(h, 'p4');
    // Every expense waits for approval, so it stays editable and removable.
    await h
      .http()
      .patch(url(s, '/modules/expenses'))
      .set(auth(s.admin))
      .send({ settings: { approval: 'ALWAYS' } });
    const cats = await h.http().get(url(s, '/expenses/categories')).set(auth(s.admin));
    const categoryId = cats.body[0].id;
    const a = await upload(s, s.admin, 'EXPENSE_RECEIPT');
    const b = await upload(s, s.admin, 'EXPENSE_RECEIPT');
    const theirs = await upload(s, s.resident.token, 'EXPENSE_RECEIPT');
    const body = {
      categoryId,
      amountPaise: 120_000,
      incurredOn: TODAY,
      payeeName: 'MSEDCL',
      method: 'BANK_TRANSFER',
    };

    const notMine = await h
      .http()
      .post(url(s, '/expenses'))
      .set(auth(s.admin))
      .send({ ...body, receiptIds: [theirs], idempotencyKey: newId() });
    expect(notMine.status).toBe(404);

    const made = await h
      .http()
      .post(url(s, '/expenses'))
      .set(auth(s.admin))
      .send({ ...body, receiptIds: [a, b], idempotencyKey: newId() });
    expect(made.status).toBe(201);
    expect(ids(made.body.receipts)).toEqual([a, b]);
    const shown = await h.http().get(made.body.receipts[0].url);
    expect(shown.status).toBe(200);

    // A photo already on this expense cannot be claimed again for another one.
    const reuse = await h
      .http()
      .post(url(s, '/expenses'))
      .set(auth(s.admin))
      .send({ ...body, receiptIds: [a], idempotencyKey: newId() });
    expect(reuse.status).toBe(404);

    const c = await upload(s, s.admin, 'EXPENSE_RECEIPT');
    const edited = await h
      .http()
      .patch(url(s, `/expenses/${made.body.id}`))
      .set(auth(s.admin))
      .send({ receiptIds: [b, c] });
    expect(edited.status).toBe(200);
    expect(ids(edited.body.receipts)).toEqual([b, c]);
    expect(await fileRows([a])).toBe(0);

    const gone = await h
      .http()
      .delete(url(s, `/expenses/${made.body.id}`))
      .set(auth(s.admin));
    expect(gone.status).toBe(200);
    expect(await fileRows([b, c])).toBe(0);
  });

  it('shows payment proof on the receipt, once even when the request repeats', async () => {
    const s = await societyWithResident(h, 'p5');
    const proof = await upload(s, s.admin, 'PAYMENT_PROOF');
    const key = newId();
    const send = () =>
      h
        .http()
        .post(url(s, '/maintenance/payments'))
        .set(auth(s.admin))
        .send({
          flatId: s.flats[0]?.id,
          amountPaise: 250_000,
          paidOn: TODAY,
          method: 'CHEQUE',
          proofIds: [proof],
          idempotencyKey: key,
        });
    const first = await send();
    expect(first.status).toBe(201);
    expect(ids(first.body.proofs)).toEqual([proof]);
    const repeat = await send();
    expect(repeat.body.id).toBe(first.body.id);
    expect(ids(repeat.body.proofs)).toEqual([proof]);

    const receipt = await h
      .http()
      .get(url(s, `/maintenance/payments/${first.body.id}`))
      .set(auth(s.resident.token));
    expect(ids(receipt.body.proofs)).toEqual([proof]);
  });

  it('keeps the photos of the last "done" on a task', async () => {
    const s = await societyWithResident(h, 'p6');
    const made = await h
      .http()
      .post(url(s, '/tasks'))
      .set(auth(s.admin))
      .send({ title: 'Submit water bill at PMC', points: 3 });
    const taskId = made.body.id;
    const act = (token: string, action: string, body: object = {}) =>
      h
        .http()
        .post(url(s, `/tasks/${taskId}/${action}`))
        .set(auth(token))
        .send(body);
    await act(s.resident.token, 'volunteer');
    const first = await upload(s, s.resident.token, 'TASK_PROOF');
    const done = await act(s.resident.token, 'submit', { note: 'Paid', proofIds: [first] });
    expect(done.status).toBe(201);
    expect(ids(done.body.proofs)).toEqual([first]);

    await act(s.admin, 'return', { reason: 'Photo is blurred' });
    const second = await upload(s, s.resident.token, 'TASK_PROOF');
    const again = await act(s.resident.token, 'submit', { proofIds: [second] });
    expect(ids(again.body.proofs)).toEqual([second]);
    expect(await fileRows([first])).toBe(0);
  });

  it('refuses unknown kinds and photos from another society', async () => {
    const a = await societyWithResident(h, 'p7a');
    const b = await societyWithResident(h, 'p7b');
    const odd = await h
      .http()
      .post(url(a, '/files?kind=PASSPORT'))
      .set(auth(a.admin))
      .attach('file', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' });
    expect(odd.status).toBe(400);

    const fromA = await upload(a, a.admin, 'SOCIETY_LOGO');
    const res = await h.http().patch(url(b)).set(auth(b.admin)).send({ logoFileId: fromA });
    expect(res.status).toBe(404);
  });
});
