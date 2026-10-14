import type { Audience } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';

/**
 * Who gets a push: turns memberships, flats, permissions and audiences into user ids for
 * `NotificationsService.notifyUsers`. Every query names the society (or ids from it) itself,
 * so it also works outside a request (jobs, join requests).
 */
@Injectable()
export class Recipients {
  constructor(private readonly prisma: PrismaService) {}

  /** Users behind these memberships. `activeOnly` skips members who left or are suspended. */
  async ofMemberships(
    membershipIds: readonly (string | null | undefined)[],
    opts: { activeOnly?: boolean } = {},
  ): Promise<string[]> {
    const ids = [...new Set(membershipIds.filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return [];
    const rows = await this.prisma.membership.findMany({
      where: { id: { in: ids }, ...(opts.activeOnly ? { status: 'ACTIVE' } : {}) },
      select: { userId: true },
    });
    return [...new Set(rows.map((r) => r.userId))];
  }

  /**
   * Active members holding a permission, optionally plus anyone in `orRoleIds`, minus one
   * membership (usually the person who acted).
   */
  async withPermission(
    societyId: string,
    permissionKey: string,
    opts: { exceptMembershipId?: string; orRoleIds?: readonly string[] } = {},
  ): Promise<string[]> {
    const holds: Prisma.MembershipRoleWhereInput = {
      role: { permissions: { some: { permissionKey } } },
    };
    const rows = await this.prisma.membership.findMany({
      where: {
        societyId,
        status: 'ACTIVE',
        ...(opts.exceptMembershipId ? { id: { not: opts.exceptMembershipId } } : {}),
        roles: {
          some: opts.orRoleIds ? { OR: [{ roleId: { in: [...opts.orRoleIds] } }, holds] } : holds,
        },
      },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  /** Active members living in each flat. */
  async ofFlats(flatIds: readonly string[]): Promise<Map<string, string[]>> {
    const rows = await this.prisma.flatOccupancy.findMany({
      where: {
        flatId: { in: [...new Set(flatIds)] },
        toDate: null,
        membership: { status: 'ACTIVE' },
      },
      select: { flatId: true, membership: { select: { userId: true } } },
    });
    const out = new Map<string, string[]>();
    for (const r of rows) out.set(r.flatId, [...(out.get(r.flatId) ?? []), r.membership.userId]);
    return out;
  }

  async ofFlat(flatId: string): Promise<string[]> {
    return (await this.ofFlats([flatId])).get(flatId) ?? [];
  }

  /** Active members an audience covers. Notices, meetings, events and SOS share it. */
  async ofAudience(societyId: string, audience: Audience): Promise<string[]> {
    const where: Prisma.MembershipWhereInput = { societyId, status: 'ACTIVE' };
    if (audience.type === 'ROLES') where.roles = { some: { roleId: { in: audience.ids } } };
    if (audience.type === 'BUILDINGS')
      where.occupancies = { some: { toDate: null, flat: { buildingId: { in: audience.ids } } } };
    if (audience.type === 'FLATS')
      where.occupancies = { some: { toDate: null, flatId: { in: audience.ids } } };
    const rows = await this.prisma.membership.findMany({ where, select: { userId: true } });
    return rows.map((r) => r.userId);
  }
}
