import type { FlatRef, MemberCard, MemberFlat, SocietySummary } from '@movo/contracts';
import { iso } from '../../common/util/dates';
import type { Building, Flat, Prisma, Society } from '../../generated/prisma/client';
import { fileUrl } from '../files/file-url';

export function toSocietySummary(s: Society): SocietySummary {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    city: s.city,
    logoUrl: fileUrl(s.logoFileId),
    defaultLocale: s.defaultLocale,
    timezone: s.timezone,
  };
}

export function toFlatRef(f: Flat & { building: Building | null }): FlatRef {
  return { id: f.id, number: f.number, buildingName: f.building?.name ?? null };
}

export const memberInclude = {
  user: true,
  roles: { include: { role: true } },
  occupancies: { where: { toDate: null }, include: { flat: { include: { building: true } } } },
} satisfies Prisma.MembershipInclude;

export type MembershipWithAll = Prisma.MembershipGetPayload<{ include: typeof memberInclude }>;

export function toMemberFlats(m: MembershipWithAll): MemberFlat[] {
  return m.occupancies.map((o) => ({
    id: o.flat.id,
    number: o.flat.number,
    buildingId: o.flat.buildingId,
    buildingName: o.flat.building?.name ?? null,
    relation: o.relation,
    isPrimaryContact: o.isPrimaryContact,
  }));
}

export function isStaffMembership(m: MembershipWithAll): boolean {
  return m.occupancies.length === 0 && m.roles.some((r) => r.role.key === 'staff');
}

/** viewerSeesContact = viewer holds member.view_contact, or is looking at themselves. */
export function toMemberCard(m: MembershipWithAll, viewerSeesContact: boolean): MemberCard {
  const showPhone = viewerSeesContact || m.privacyShowPhone;
  const showEmail = viewerSeesContact || m.privacyShowEmail;
  return {
    membershipId: m.id,
    userId: m.userId,
    displayName: m.user.displayName,
    avatarUrl: fileUrl(m.user.avatarFileId),
    status: m.status,
    roles: m.roles
      .map((r) => ({ id: r.role.id, key: r.role.key, name: r.role.name }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    flats: toMemberFlats(m),
    phone: showPhone ? m.user.phone : null,
    email: showEmail ? m.user.email : null,
    isStaff: isStaffMembership(m),
    joinedAt: iso(m.joinedAt),
  };
}
