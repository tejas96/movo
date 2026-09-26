import type { Audience } from '@movo/contracts';
import type { PrismaService } from '../../common/prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

export interface AudienceViewer {
  roleIds: readonly string[];
  flatIds: readonly string[];
  buildingIds: readonly string[];
}

/** Pure. Used both to filter lists for a viewer and to decide who gets notified. */
export function matchesAudience(audience: Audience, viewer: AudienceViewer): boolean {
  switch (audience.type) {
    case 'ALL':
      return true;
    case 'ROLES':
      return audience.ids.some((id) => viewer.roleIds.includes(id));
    case 'BUILDINGS':
      return audience.ids.some((id) => viewer.buildingIds.includes(id));
    case 'FLATS':
      return audience.ids.some((id) => viewer.flatIds.includes(id));
  }
}

/** User ids of the active members an audience covers. Notices, meetings and events share it. */
export async function audienceUserIds(
  prisma: PrismaService,
  societyId: string,
  audience: Audience,
): Promise<string[]> {
  const where: Prisma.MembershipWhereInput = { societyId, status: 'ACTIVE' };
  if (audience.type === 'ROLES') where.roles = { some: { roleId: { in: audience.ids } } };
  if (audience.type === 'BUILDINGS')
    where.occupancies = { some: { toDate: null, flat: { buildingId: { in: audience.ids } } } };
  if (audience.type === 'FLATS')
    where.occupancies = { some: { toDate: null, flatId: { in: audience.ids } } };
  const rows = await prisma.membership.findMany({ where, select: { userId: true } });
  return rows.map((r) => r.userId);
}
