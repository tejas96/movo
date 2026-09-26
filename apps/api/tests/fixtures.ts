import { type Harness, login } from './harness';

export const auth = (token: string) => ({ authorization: `Bearer ${token}` });

export interface SocietyFixture {
  societyId: string;
  admin: string;
  adminMembershipId: string;
  /** Flats 101 and 102. */
  flats: { id: string; number: string }[];
  /** Resident of flat 101. */
  resident: { token: string; userId: string; membershipId: string };
}

/** A society with an admin, two flats, and one resident living in flat 101. */
export async function societyWithResident(h: Harness, tag: string): Promise<SocietyFixture> {
  const platform = await h.makePlatformAdmin();
  const adminEmail = `admin-${tag}@movo.test`;
  const { societyId, adminMembershipId } = await h.createSociety(
    platform.token,
    `Society ${tag}`,
    adminEmail,
  );
  const admin = await login(h, adminEmail);
  const flats = await h
    .http()
    .post(`/v1/societies/${societyId}/flats`)
    .set(auth(admin))
    .send({ flats: [{ number: '101' }, { number: '102' }] });
  const invite = await h
    .http()
    .post(`/v1/societies/${societyId}/invitations`)
    .set(auth(admin))
    .send({ inviteeName: `Resident ${tag}`, flatId: flats.body[0].id });
  const resident = await h.register(`resident-${tag}@movo.test`, `Resident ${tag}`);
  const joined = await h
    .http()
    .post('/v1/join/invite')
    .set(auth(resident.token))
    .send({ code: invite.body.code });
  if (joined.status !== 201)
    throw new Error(`join failed: ${joined.status} ${JSON.stringify(joined.body)}`);
  const ctx = await h.http().get('/v1/me/context').set(auth(resident.token));
  const membership = ctx.body.memberships.find(
    (m: { society: { id: string } }) => m.society.id === societyId,
  );
  return {
    societyId,
    admin,
    adminMembershipId,
    flats: flats.body.map((f: { id: string; number: string }) => ({ id: f.id, number: f.number })),
    resident: { token: resident.token, userId: resident.userId, membershipId: membership.id },
  };
}
