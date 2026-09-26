import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auth, societyWithResident } from './fixtures';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

describe('parking', () => {
  it('admin adds slots and allocates; resident sees own parking and manages own vehicles', async () => {
    const s = await societyWithResident(h, 'p1');
    const base = `/v1/societies/${s.societyId}/parking`;
    const [flat101, flat102] = s.flats;
    if (!flat101 || !flat102) throw new Error('flats missing');

    const created = await h
      .http()
      .post(`${base}/slots`)
      .set(auth(s.admin))
      .send({
        slots: [
          { code: 'p-10', type: 'FOUR_WHEELER', level: 'B1' },
          { code: 'P-2', type: 'TWO_WHEELER' },
          { code: 'P-1' },
        ],
      });
    expect(created.status).toBe(201);
    expect(created.body.map((x: { code: string }) => x.code)).toEqual(['P-1', 'P-2', 'P-10']);
    const dupe = await h
      .http()
      .post(`${base}/slots`)
      .set(auth(s.admin))
      .send({ slots: [{ code: 'P-1' }] });
    expect(dupe.status).toBe(409);
    const byResident = await h
      .http()
      .post(`${base}/slots`)
      .set(auth(s.resident.token))
      .send({ slots: [{ code: 'X' }] });
    expect(byResident.status).toBe(403);

    const p1 = created.body[0].id as string;
    const give = await h
      .http()
      .post(`${base}/slots/${p1}/allocation`)
      .set(auth(s.admin))
      .send({ flatId: flat101.id, notes: 'near lift' });
    expect(give.status).toBe(201);
    expect(give.body.allocation.flat.number).toBe('101');
    const again = await h
      .http()
      .post(`${base}/slots/${p1}/allocation`)
      .set(auth(s.admin))
      .send({ flatId: flat102.id });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('SLOT_TAKEN');

    const free = await h.http().get(`${base}/slots?free=true`).set(auth(s.admin));
    expect(free.body.map((x: { code: string }) => x.code)).toEqual(['P-2', 'P-10']);
    const membersList = await h.http().get(`${base}/slots`).set(auth(s.resident.token));
    expect(membersList.status).toBe(403);

    const car = await h
      .http()
      .post(`${base}/vehicles`)
      .set(auth(s.resident.token))
      .send({ flatId: flat101.id, registrationNo: 'mh 12 ab-1234', makeModel: 'Swift' });
    expect(car.status).toBe(201);
    expect(car.body.registrationNo).toBe('MH12AB1234');
    const same = await h
      .http()
      .post(`${base}/vehicles`)
      .set(auth(s.admin))
      .send({ flatId: flat102.id, registrationNo: 'MH12AB1234' });
    expect(same.status).toBe(409);
    expect(same.body.code).toBe('VEHICLE_EXISTS');
    const otherFlat = await h
      .http()
      .post(`${base}/vehicles`)
      .set(auth(s.resident.token))
      .send({ flatId: flat102.id, registrationNo: 'MH14ZZ0001' });
    expect(otherFlat.status).toBe(403);
    const adminCar = await h
      .http()
      .post(`${base}/vehicles`)
      .set(auth(s.admin))
      .send({ flatId: flat102.id, registrationNo: 'MH14ZZ0001', type: 'TWO_WHEELER' });
    expect(adminCar.status).toBe(201);

    const mine = await h.http().get(`${base}/me`).set(auth(s.resident.token));
    expect(mine.status).toBe(200);
    expect(mine.body.canSeeAll).toBe(false);
    expect(mine.body.flats).toHaveLength(1);
    expect(mine.body.flats[0].slots.map((x: { code: string }) => x.code)).toEqual(['P-1']);
    expect(
      mine.body.flats[0].vehicles.map((v: { registrationNo: string }) => v.registrationNo),
    ).toEqual(['MH12AB1234']);

    // Residents only see their own vehicles; the admin sees all and can search.
    const residentVehicles = await h.http().get(`${base}/vehicles`).set(auth(s.resident.token));
    expect(residentVehicles.body).toHaveLength(1);
    const search = await h.http().get(`${base}/vehicles?q=zz 00`).set(auth(s.admin));
    expect(search.body.map((v: { registrationNo: string }) => v.registrationNo)).toEqual([
      'MH14ZZ0001',
    ]);

    // Member detail shows vehicles to contact viewers (default ADMINS), not to residents.
    const detailForAdmin = await h
      .http()
      .get(`/v1/societies/${s.societyId}/members/${s.resident.membershipId}`)
      .set(auth(s.admin));
    expect(detailForAdmin.body.vehicles).toHaveLength(1);
    const detailForSelf = await h
      .http()
      .get(`/v1/societies/${s.societyId}/members/${s.resident.membershipId}`)
      .set(auth(s.resident.token));
    expect(detailForSelf.body.vehicles).toHaveLength(1);
    const adminDetailForResident = await h
      .http()
      .get(`/v1/societies/${s.societyId}/members/${s.adminMembershipId}`)
      .set(auth(s.resident.token));
    expect(adminDetailForResident.body.vehicles).toBeNull();

    const edit = await h
      .http()
      .patch(`${base}/vehicles/${car.body.id}`)
      .set(auth(s.resident.token))
      .send({ color: 'White' });
    expect(edit.body.color).toBe('White');
    const deleteOthers = await h
      .http()
      .delete(`${base}/vehicles/${adminCar.body.id}`)
      .set(auth(s.resident.token));
    expect(deleteOthers.status).toBe(403);
    const del = await h
      .http()
      .delete(`${base}/vehicles/${car.body.id}`)
      .set(auth(s.resident.token));
    expect(del.status).toBe(200);

    const release = await h.http().delete(`${base}/slots/${p1}/allocation`).set(auth(s.admin));
    expect(release.body.allocation).toBeNull();
    const releaseAgain = await h.http().delete(`${base}/slots/${p1}/allocation`).set(auth(s.admin));
    expect(releaseAgain.status).toBe(200);
    const block = await h
      .http()
      .patch(`${base}/slots/${p1}`)
      .set(auth(s.admin))
      .send({ status: 'BLOCKED' });
    expect(block.body.status).toBe('BLOCKED');
    const giveBlocked = await h
      .http()
      .post(`${base}/slots/${p1}/allocation`)
      .set(auth(s.admin))
      .send({ flatId: flat102.id });
    expect(giveBlocked.status).toBe(409);

    const audit = await h.prisma.auditLog.findMany({
      where: { societyId: s.societyId, action: { startsWith: 'parking.' } },
    });
    expect(audit.map((a) => a.action).sort()).toEqual([
      'parking.allocated',
      'parking.released',
      'parking.slot.created',
      'parking.slot.updated',
    ]);
  });

  it('members see every slot when the society allows it; module switch-off blocks routes', async () => {
    const s = await societyWithResident(h, 'p2');
    const setting = await h
      .http()
      .patch(`/v1/societies/${s.societyId}/modules/parking`)
      .set(auth(s.admin))
      .send({ settings: { membersSeeAllAllocations: true } });
    expect(setting.status).toBe(200);
    const list = await h
      .http()
      .get(`/v1/societies/${s.societyId}/parking/slots`)
      .set(auth(s.resident.token));
    expect(list.status).toBe(200);

    await h
      .http()
      .patch(`/v1/societies/${s.societyId}/modules/parking`)
      .set(auth(s.admin))
      .send({ enabled: false });
    const off = await h
      .http()
      .get(`/v1/societies/${s.societyId}/parking/me`)
      .set(auth(s.resident.token));
    expect(off.status).toBe(403);
    expect(off.body.code).toBe('MODULE_DISABLED');
  });

  it('cross-tenant: society B cannot read or touch A parking, even with A ids', async () => {
    const a = await societyWithResident(h, 'pa');
    const b = await societyWithResident(h, 'pb');
    const slotA = await h
      .http()
      .post(`/v1/societies/${a.societyId}/parking/slots`)
      .set(auth(a.admin))
      .send({ slots: [{ code: 'A1' }] });
    const carA = await h
      .http()
      .post(`/v1/societies/${a.societyId}/parking/vehicles`)
      .set(auth(a.admin))
      .send({ flatId: a.flats[0]?.id, registrationNo: 'MH01AA0001' });
    const slotId = slotA.body[0].id as string;

    for (const path of [
      `/v1/societies/${a.societyId}/parking/me`,
      `/v1/societies/${a.societyId}/parking/slots`,
      `/v1/societies/${a.societyId}/parking/vehicles`,
    ]) {
      const res = await h.http().get(path).set(auth(b.admin));
      expect(res.status, path).toBe(404);
    }
    // Using B's own society id with A's record ids must not reach A's rows.
    const give = await h
      .http()
      .post(`/v1/societies/${b.societyId}/parking/slots/${slotId}/allocation`)
      .set(auth(b.admin))
      .send({ flatId: b.flats[0]?.id });
    expect(give.status).toBe(404);
    const giveAFlat = await h
      .http()
      .post(`/v1/societies/${b.societyId}/parking/vehicles`)
      .set(auth(b.admin))
      .send({ flatId: a.flats[0]?.id, registrationNo: 'MH01AA0002' });
    expect(giveAFlat.status).toBe(404);
    const editCar = await h
      .http()
      .patch(`/v1/societies/${b.societyId}/parking/vehicles/${carA.body.id}`)
      .set(auth(b.admin))
      .send({ color: 'Red' });
    expect(editCar.status).toBe(404);
    const vehiclesB = await h
      .http()
      .get(`/v1/societies/${b.societyId}/parking/vehicles`)
      .set(auth(b.admin));
    expect(vehiclesB.body).toEqual([]);
    // Registration numbers are unique per society, not across societies.
    const sameNumberInB = await h
      .http()
      .post(`/v1/societies/${b.societyId}/parking/vehicles`)
      .set(auth(b.admin))
      .send({ flatId: b.flats[0]?.id, registrationNo: 'MH01AA0001' });
    expect(sameNumberInB.status).toBe(201);
  });
});
