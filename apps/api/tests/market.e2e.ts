import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auth, type SocietyFixture, societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const url = (s: SocietyFixture, rest = '') => `/v1/societies/${s.societyId}${rest}`;
/** Enough of a JPEG for the server's first-bytes check. */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);

async function market(tag: string, settings: Record<string, unknown> = {}) {
  const s = await societyWithResident(h, tag);
  const on = await h
    .http()
    .patch(url(s, '/modules/marketplace'))
    .set(auth(s.admin))
    .send({ enabled: true, settings });
  if (on.status !== 200) throw new Error(`module: ${on.status} ${JSON.stringify(on.body)}`);
  return s;
}

async function upload(s: SocietyFixture, token: string, body: Buffer = JPEG) {
  return h
    .http()
    .post(url(s, '/files'))
    .set(auth(token))
    .attach('file', body, { filename: 'a.jpg', contentType: 'image/jpeg' });
}

const tiffin = {
  kind: 'FOOD',
  title: 'Poha and chai',
  priceType: 'PER_UNIT',
  pricePaise: 6000,
  unit: 'plate',
  diet: 'VEG',
  quantityAvailable: 5,
  fulfilment: 'BOTH',
  showPhoneAfterAccept: true,
};

async function listing(s: SocietyFixture, token: string, body: Record<string, unknown> = {}) {
  const res = await h
    .http()
    .post(url(s, '/market/listings'))
    .set(auth(token))
    .send({ ...tiffin, ...body });
  if (res.status !== 201) throw new Error(`listing: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

const act = (s: SocietyFixture, token: string, orderId: string, action: string, body = {}) =>
  h
    .http()
    .post(url(s, `/market/orders/${orderId}/${action}`))
    .set(auth(token))
    .send(body);

async function notes(token: string) {
  const res = await h.http().get('/v1/me/notifications?limit=50').set(auth(token));
  return (res.body.items as { title: string }[]).map((n) => n.title);
}

describe('market', () => {
  it('is off until the society switches it on', async () => {
    const s = await societyWithResident(h, 'm0');
    const res = await h.http().get(url(s, '/market/listings')).set(auth(s.resident.token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('MODULE_DISABLED');
  });

  it('uploads a photo, serves it by signed url only, and rejects non-images', async () => {
    const s = await market('m1');
    const up = await upload(s, s.resident.token);
    expect(up.status).toBe(201);
    expect(up.body.url).toMatch(/^\/v1\/files\/[0-9a-f-]+\?e=\d+&s=/);

    const got = await h.http().get(up.body.url);
    expect(got.status).toBe(200);
    expect(got.headers['content-type']).toContain('image/jpeg');
    const tampered = await h.http().get(up.body.url.replace(/s=[^&]+/, 's=xxxx'));
    expect(tampered.status).toBe(404);

    const text = await upload(s, s.resident.token, Buffer.from('hello, not an image'));
    expect(text.status).toBe(400);
  });

  it('runs a food order from request to review, with stock and phone rules', async () => {
    const s = await market('m2');
    const photo = await upload(s, s.admin);
    const l = await listing(s, s.admin, {
      imageIds: [photo.body.id],
      description: 'Fresh at 8',
    });
    expect(l).toMatchObject({
      kind: 'FOOD',
      diet: 'VEG',
      quantityAvailable: 5,
      canOrder: false,
      canEdit: true,
      images: [{ id: photo.body.id }],
    });
    expect(l.cover.id).toBe(photo.body.id);

    const feed = await h
      .http()
      .get(url(s, '/market/listings?kind=FOOD'))
      .set(auth(s.resident.token));
    expect(feed.body.items.map((x: { id: string }) => x.id)).toEqual([l.id]);
    const seen = await h
      .http()
      .get(url(s, `/market/listings/${l.id}`))
      .set(auth(s.resident.token));
    expect(seen.body).toMatchObject({
      canOrder: true,
      isMine: false,
      seller: { displayName: expect.any(String) },
    });

    const tooMany = await h
      .http()
      .post(url(s, `/market/listings/${l.id}/orders`))
      .set(auth(s.resident.token))
      .send({ quantity: 6 });
    expect(tooMany.body.code).toBe('OUT_OF_STOCK');

    const o = await h
      .http()
      .post(url(s, `/market/listings/${l.id}/orders`))
      .set(auth(s.resident.token))
      .send({ quantity: 2, fulfilment: 'DELIVERY', note: 'No onion please' });
    expect(o.status).toBe(201);
    expect(o.body).toMatchObject({
      status: 'REQUESTED',
      totalPaise: 12000,
      role: 'BUYING',
      canCancel: true,
      seller: { flat: null, phone: null },
    });
    const again = await h
      .http()
      .post(url(s, `/market/listings/${l.id}/orders`))
      .set(auth(s.resident.token))
      .send({ quantity: 1 });
    expect(again.status).toBe(409);
    expect(await notes(s.admin)).toContain('New order: Poha and chai');
    const home = await h.http().get(url(s, '/home')).set(auth(s.admin));
    expect(home.body.attention).toContainEqual({ type: 'MARKET_ORDERS_WAITING', count: 1 });

    // Only the seller accepts.
    expect((await act(s, s.resident.token, o.body.id, 'accept')).status).toBe(403);
    const accepted = await act(s, s.admin, o.body.id, 'accept');
    expect(accepted.body).toMatchObject({
      status: 'ACCEPTED',
      buyer: { flat: '101' },
      canMarkReady: true,
    });
    const afterStock = await h
      .http()
      .get(url(s, `/market/listings/${l.id}`))
      .set(auth(s.admin));
    expect(afterStock.body.quantityAvailable).toBe(3);
    const buyerView = await h
      .http()
      .get(url(s, `/market/orders/${o.body.id}`))
      .set(auth(s.resident.token));
    expect(buyerView.body.seller.phone).toBeNull(); // the admin fixture signed up by email

    const msg = await act(s, s.resident.token, o.body.id, 'messages', { body: 'Coming at 8:15' });
    expect(msg.body.messages).toEqual([
      expect.objectContaining({ body: 'Coming at 8:15', mine: true }),
    ]);
    const sellerList = await h.http().get(url(s, '/market/orders?role=SELLING')).set(auth(s.admin));
    expect(sellerList.body[0]).toMatchObject({
      unreadMessages: 1,
      counterpart: { displayName: 'Resident m2' },
    });
    await h
      .http()
      .get(url(s, `/market/orders/${o.body.id}`))
      .set(auth(s.admin));
    const read = await h.http().get(url(s, '/market/orders?role=SELLING')).set(auth(s.admin));
    expect(read.body[0].unreadMessages).toBe(0);

    expect((await act(s, s.admin, o.body.id, 'ready')).body.status).toBe('READY');
    expect(await notes(s.resident.token)).toContain('Ready: Poha and chai');
    // Too early to review.
    expect((await act(s, s.resident.token, o.body.id, 'review', { rating: 5 })).status).toBe(409);
    expect((await act(s, s.resident.token, o.body.id, 'complete')).body.status).toBe('COMPLETED');
    const reviewed = await act(s, s.resident.token, o.body.id, 'review', {
      rating: 4,
      text: 'Tasty',
    });
    expect(reviewed.body.review).toMatchObject({ rating: 4, text: 'Tasty' });
    expect((await act(s, s.resident.token, o.body.id, 'review', { rating: 5 })).status).toBe(409);
    const rated = await h
      .http()
      .get(url(s, `/market/listings/${l.id}`))
      .set(auth(s.resident.token));
    expect(rated.body.rating).toEqual({ average: 4, count: 1 });
    expect(rated.body.reviews[0]).toMatchObject({ rating: 4, by: 'Resident m2' });
  });

  it('gives stock back when an accepted order is cancelled and closes orders after order-by', async () => {
    const s = await market('m3');
    const l = await listing(s, s.admin, { quantityAvailable: 2 });
    const o = await h
      .http()
      .post(url(s, `/market/listings/${l.id}/orders`))
      .set(auth(s.resident.token))
      .send({ quantity: 2 });
    await act(s, s.admin, o.body.id, 'accept');
    const sold = await h
      .http()
      .get(url(s, `/market/listings/${l.id}`))
      .set(auth(s.resident.token));
    expect(sold.body).toMatchObject({ soldOut: true, canOrder: false });
    const cancelled = await act(s, s.resident.token, o.body.id, 'cancel', {
      reason: 'Plans changed',
    });
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', reason: 'Plans changed' });
    const back = await h
      .http()
      .get(url(s, `/market/listings/${l.id}`))
      .set(auth(s.resident.token));
    expect(back.body.quantityAvailable).toBe(2);

    const past = new Date(Date.now() - 60_000).toISOString();
    const closed = await listing(s, s.admin, { title: 'Lunch thali', orderBy: past });
    expect(closed.ordersClosed).toBe(true);
    const late = await h
      .http()
      .post(url(s, `/market/listings/${closed.id}/orders`))
      .set(auth(s.resident.token))
      .send({ quantity: 1 });
    expect(late.body.code).toBe('ORDERS_CLOSED');
  });

  it('checks listing rules and society settings', async () => {
    const s = await market('m4', { resaleEnabled: false });
    const noDiet = await h
      .http()
      .post(url(s, '/market/listings'))
      .set(auth(s.resident.token))
      .send({ ...tiffin, diet: null });
    expect(noDiet.status).toBe(400);
    const noPrice = await h
      .http()
      .post(url(s, '/market/listings'))
      .set(auth(s.resident.token))
      .send({ kind: 'PRODUCT', title: 'Mango pickle', priceType: 'FIXED' });
    expect(noPrice.status).toBe(400);
    const resale = await h
      .http()
      .post(url(s, '/market/listings'))
      .set(auth(s.resident.token))
      .send({ kind: 'RESALE', title: 'Cycle', priceType: 'NEGOTIABLE' });
    expect(resale.status).toBe(400);
    const network = await h
      .http()
      .post(url(s, '/market/listings'))
      .set(auth(s.resident.token))
      .send({
        kind: 'SERVICE',
        title: 'Maths tuition',
        priceType: 'NEGOTIABLE',
        visibility: 'NETWORK',
      });
    expect(network.status).toBe(400);

    // Someone else's photo cannot be used.
    const theirs = await upload(s, s.admin);
    const stolen = await h
      .http()
      .post(url(s, '/market/listings'))
      .set(auth(s.resident.token))
      .send({ kind: 'SERVICE', title: 'Tuition', priceType: 'FREE', imageIds: [theirs.body.id] });
    expect(stolen.status).toBe(404);

    const free = await listing(s, s.resident.token, {
      kind: 'SERVICE',
      title: 'Tuition',
      priceType: 'FREE',
      pricePaise: 5000,
      diet: 'VEG',
      readyAt: new Date().toISOString(),
    });
    expect(free).toMatchObject({ pricePaise: null, diet: null, readyAt: null, unit: null });

    const paused = await h
      .http()
      .post(url(s, `/market/listings/${free.id}/status`))
      .set(auth(s.resident.token))
      .send({ status: 'PAUSED' });
    expect(paused.body.status).toBe('PAUSED');
    const feed = await h.http().get(url(s, '/market/listings')).set(auth(s.admin));
    expect(feed.body.items).toHaveLength(0);
    const edit = await h
      .http()
      .patch(url(s, `/market/listings/${free.id}`))
      .set(auth(s.admin))
      .send({ title: 'Mine now' });
    expect(edit.status).toBe(404);
  });

  it('lets members report and moderators hide, which cancels open orders', async () => {
    const s = await market('m5');
    const l = await listing(s, s.resident.token, {
      title: 'Suspicious pills',
      kind: 'PRODUCT',
      diet: null,
    });
    const buyer = await h
      .http()
      .post(url(s, `/market/listings/${l.id}/orders`))
      .set(auth(s.admin))
      .send({ quantity: 1 });
    expect(buyer.status).toBe(201);

    const own = await h
      .http()
      .post(url(s, `/market/listings/${l.id}/report`))
      .set(auth(s.resident.token))
      .send({ reason: 'test' });
    expect(own.status).toBe(400);
    const rep = await h
      .http()
      .post(url(s, `/market/listings/${l.id}/report`))
      .set(auth(s.admin))
      .send({ reason: 'Medicines are not allowed' });
    expect(rep.status).toBe(201);
    const reports = await h.http().get(url(s, '/market/reports')).set(auth(s.admin));
    expect(reports.body).toEqual([
      expect.objectContaining({
        reason: 'Medicines are not allowed',
        listing: expect.objectContaining({ id: l.id }),
      }),
    ]);
    expect((await h.http().get(url(s, '/market/reports')).set(auth(s.resident.token))).status).toBe(
      403,
    );

    const hidden = await h
      .http()
      .post(url(s, `/market/listings/${l.id}/hide`))
      .set(auth(s.admin))
      .send({ reason: 'Medicines are not allowed' });
    expect(hidden.body).toMatchObject({
      status: 'HIDDEN',
      hiddenReason: 'Medicines are not allowed',
    });
    const order = await h
      .http()
      .get(url(s, `/market/orders/${buyer.body.id}`))
      .set(auth(s.admin));
    expect(order.body.status).toBe('CANCELLED');
    expect((await h.http().get(url(s, '/market/reports')).set(auth(s.admin))).body).toEqual([]);
    expect(await notes(s.resident.token)).toContain(
      'Your listing was taken down: Suspicious pills',
    );
    const sellerEdit = await h
      .http()
      .post(url(s, `/market/listings/${l.id}/status`))
      .set(auth(s.resident.token))
      .send({ status: 'ACTIVE' });
    expect(sellerEdit.status).toBe(403);

    const audit = await h.http().get(url(s, '/audit?limit=5')).set(auth(s.admin));
    expect(audit.body.items[0].action).toBe('listing.hidden');
    const back = await h
      .http()
      .post(url(s, `/market/listings/${l.id}/unhide`))
      .set(auth(s.admin));
    expect(back.body.status).toBe('PAUSED');
  });

  it('keeps listings, orders and photos inside their society', async () => {
    const a = await market('m6a');
    const b = await market('m6b');
    const l = await listing(a, a.admin);
    const cross = await h
      .http()
      .get(url(b, `/market/listings/${l.id}`))
      .set(auth(b.admin));
    expect(cross.status).toBe(404);
    const order = await h
      .http()
      .post(url(b, `/market/listings/${l.id}/orders`))
      .set(auth(b.resident.token))
      .send({ quantity: 1 });
    expect(order.status).toBe(404);
    const photo = await upload(a, a.admin);
    const reuse = await h
      .http()
      .post(url(b, '/market/listings'))
      .set(auth(b.admin))
      .send({ ...tiffin, imageIds: [photo.body.id] });
    expect(reuse.status).toBe(404);
  });
});
