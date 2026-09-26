import type { PrismaService } from '../../common/prisma/prisma.service';

export interface MemberName {
  displayName: string;
  phone: string | null;
}

/** Display names (and phones) for a set of memberships, for "added by" and "raised by" labels. */
export async function loadMemberNames(
  prisma: PrismaService,
  membershipIds: readonly (string | null | undefined)[],
): Promise<Map<string, MemberName>> {
  const ids = [...new Set(membershipIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();
  const rows = await prisma.membership.findMany({
    where: { id: { in: ids } },
    select: { id: true, user: { select: { displayName: true, phone: true } } },
  });
  return new Map(rows.map((m) => [m.id, { displayName: m.user.displayName, phone: m.user.phone }]));
}
