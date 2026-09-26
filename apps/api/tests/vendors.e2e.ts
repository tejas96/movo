import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auth, societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

type Named = { name: string };

describe('vendors (services)', () => {
  it('seeds categories, lets the committee add vendors and members suggest them', async () => {
    const s = await societyWithResident(h, 'v1');
    const base = `/v1/societies/${s.societyId}`;

    const categories = await h.http().get(`${base}/vendor-categories`).set(auth(s.resident.token));
    expect(categories.status).toBe(200);
    expect(categories.body.length).toBeGreaterThanOrEqual(10);
    const plumber = categories.body.find((c: { key: string }) => c.key === 'plumber');
    expect(plumber).toMatchObject({ name: 'Plumber', icon: 'water', vendorCount: 0 });

    const ramesh = await h.http().post(`${base}/vendors`).set(auth(s.admin)).send({
      categoryId: plumber.id,
      name: 'Ramesh Plumbing',
      phone: '+919800000001',
      availability: '9 AM to 7 PM',
      adminNotes: 'Charges ₹300 visit fee',
    });
    expect(ramesh.status).toBe(201);
    expect(ramesh.body.status).toBe('APPROVED');
    await h
      .http()
      .post(`${base}/vendors`)
      .set(auth(s.admin))
      .send({ categoryId: plumber.id, name: 'Blocked Guy', phone: '+919800000009' })
      .then((r) =>
        h
          .http()
          .patch(`${base}/vendors/${r.body.id}`)
          .set(auth(s.admin))
          .send({ status: 'BLOCKED' }),
      );

    const suggestion = await h.http().post(`${base}/vendors`).set(auth(s.resident.token)).send({
      categoryId: plumber.id,
      name: 'Suresh Pipes',
      phone: '+919800000002',
      status: 'APPROVED',
      adminNotes: 'sneaky',
    });
    expect(suggestion.status).toBe(201);
    expect(suggestion.body.status).toBe('SUGGESTED');
    expect(suggestion.body.adminNotes).toBeNull();

    // A resident sees approved vendors plus their own suggestion, never blocked ones or notes.
    const asResident = await h
      .http()
      .get(`${base}/vendors?categoryId=${plumber.id}`)
      .set(auth(s.resident.token));
    expect(asResident.body.map((v: Named) => v.name)).toEqual(['Ramesh Plumbing', 'Suresh Pipes']);
    expect(asResident.body[0].adminNotes).toBeNull();
    const asAdmin = await h
      .http()
      .get(`${base}/vendors?categoryId=${plumber.id}`)
      .set(auth(s.admin));
    expect(asAdmin.body.map((v: Named) => v.name)).toEqual([
      'Ramesh Plumbing',
      'Suresh Pipes',
      'Blocked Guy',
    ]);
    expect(asAdmin.body[0].adminNotes).toBe('Charges ₹300 visit fee');

    const search = await h.http().get(`${base}/vendors?q=plumb`).set(auth(s.resident.token));
    expect(search.body.map((v: Named) => v.name)).toContain('Ramesh Plumbing');

    const home = await h.http().get(`${base}/home`).set(auth(s.admin));
    expect(home.body.attention).toContainEqual({ type: 'VENDOR_SUGGESTIONS', count: 1 });

    const approve = await h
      .http()
      .patch(`${base}/vendors/${suggestion.body.id}`)
      .set(auth(s.admin))
      .send({ status: 'APPROVED' });
    expect(approve.body.status).toBe('APPROVED');
    const residentEdit = await h
      .http()
      .patch(`${base}/vendors/${ramesh.body.id}`)
      .set(auth(s.resident.token))
      .send({ name: 'x' });
    expect(residentEdit.status).toBe(403);

    const counts = await h.http().get(`${base}/vendor-categories`).set(auth(s.resident.token));
    expect(counts.body.find((c: { id: string }) => c.id === plumber.id).vendorCount).toBe(2);

    // Suggestions can be switched off.
    await h
      .http()
      .patch(`${base}/modules/vendors`)
      .set(auth(s.admin))
      .send({ settings: { membersCanSuggest: false } });
    const blocked = await h
      .http()
      .post(`${base}/vendors`)
      .set(auth(s.resident.token))
      .send({ categoryId: plumber.id, name: 'Late', phone: '+919800000003' });
    expect(blocked.status).toBe(403);
  });

  it('manages categories and refuses to delete a category with vendors', async () => {
    const s = await societyWithResident(h, 'v2');
    const base = `/v1/societies/${s.societyId}`;
    const cat = await h
      .http()
      .post(`${base}/vendor-categories`)
      .set(auth(s.admin))
      .send({ name: 'Tailor', icon: 'bag' });
    expect(cat.status).toBe(201);
    expect(cat.body).toMatchObject({ key: null, name: 'Tailor', icon: 'bag' });
    const badIcon = await h
      .http()
      .post(`${base}/vendor-categories`)
      .set(auth(s.admin))
      .send({ name: 'Other', icon: 'rocket' });
    expect(badIcon.status).toBe(400);
    const vendor = await h
      .http()
      .post(`${base}/vendors`)
      .set(auth(s.admin))
      .send({ categoryId: cat.body.id, name: 'Meena Tailors', phone: '+919800000004' });
    const refuse = await h
      .http()
      .delete(`${base}/vendor-categories/${cat.body.id}`)
      .set(auth(s.admin));
    expect(refuse.status).toBe(409);
    expect(refuse.body.code).toBe('CATEGORY_NOT_EMPTY');
    await h.http().delete(`${base}/vendors/${vendor.body.id}`).set(auth(s.admin));
    const ok = await h.http().delete(`${base}/vendor-categories/${cat.body.id}`).set(auth(s.admin));
    expect(ok.status).toBe(200);

    const seeded = (await h.http().get(`${base}/vendor-categories`).set(auth(s.admin))).body[0];
    const renamed = await h
      .http()
      .patch(`${base}/vendor-categories/${seeded.id}`)
      .set(auth(s.admin))
      .send({ name: 'Plumbing and drainage' });
    expect(renamed.body.key).toBeNull();
    const byResident = await h
      .http()
      .post(`${base}/vendor-categories`)
      .set(auth(s.resident.token))
      .send({ name: 'Mine' });
    expect(byResident.status).toBe(403);
  });

  it('cross-tenant: B never sees or edits A vendors', async () => {
    const a = await societyWithResident(h, 'va');
    const b = await societyWithResident(h, 'vb');
    const catA = (
      await h.http().get(`/v1/societies/${a.societyId}/vendor-categories`).set(auth(a.admin))
    ).body[0];
    const vendorA = await h
      .http()
      .post(`/v1/societies/${a.societyId}/vendors`)
      .set(auth(a.admin))
      .send({ categoryId: catA.id, name: 'A only', phone: '+919800000005' });

    const readA = await h.http().get(`/v1/societies/${a.societyId}/vendors`).set(auth(b.admin));
    expect(readA.status).toBe(404);
    const viaB = await h
      .http()
      .get(`/v1/societies/${b.societyId}/vendors/${vendorA.body.id}`)
      .set(auth(b.admin));
    expect(viaB.status).toBe(404);
    const editViaB = await h
      .http()
      .patch(`/v1/societies/${b.societyId}/vendors/${vendorA.body.id}`)
      .set(auth(b.admin))
      .send({ name: 'hacked' });
    expect(editViaB.status).toBe(404);
    const createInACategory = await h
      .http()
      .post(`/v1/societies/${b.societyId}/vendors`)
      .set(auth(b.admin))
      .send({ categoryId: catA.id, name: 'Sneaky', phone: '+919800000006' });
    expect(createInACategory.status).toBe(404);
    const listB = await h.http().get(`/v1/societies/${b.societyId}/vendors`).set(auth(b.admin));
    expect(listB.body).toEqual([]);
  });
});
