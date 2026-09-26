import {
  AUDIT_AREAS,
  type AuditAction,
  type AuditEntry,
  type RouteQuery,
  type societyContract,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireTenant } from '../../common/request-store';
import { decodeCursor, slicePage } from '../../common/util/pagination';
import type { Prisma } from '../../generated/prisma/client';

type ListQuery = RouteQuery<typeof societyContract.listAudit>;

/** Read side of the audit log. AuditLog is not a tenant model, so every query names the society. */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListQuery): Promise<{ items: AuditEntry[]; nextCursor: string | null }> {
    const ctx = requireTenant();
    const cursor = decodeCursor(query.cursor);
    const where: Prisma.AuditLogWhereInput = {
      societyId: ctx.societyId,
      ...(query.entityId ? { entityId: query.entityId } : {}),
      AND: [
        query.area
          ? { OR: AUDIT_AREAS[query.area].map((prefix) => ({ action: { startsWith: prefix } })) }
          : {},
        cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.at } },
                { createdAt: cursor.at, id: { lt: cursor.id } },
              ],
            }
          : {},
      ],
    };
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = slicePage(rows, query.limit);

    const membershipIds = [
      ...new Set(page.items.map((r) => r.actorMembershipId).filter((x): x is string => !!x)),
    ];
    const userIds = [
      ...new Set(
        page.items
          .filter((r) => !r.actorMembershipId && r.actorUserId)
          .map((r) => r.actorUserId as string),
      ),
    ];
    const [memberships, users] = await Promise.all([
      this.prisma.membership.findMany({
        where: { id: { in: membershipIds }, societyId: ctx.societyId },
        select: { id: true, user: { select: { displayName: true } } },
      }),
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true },
      }),
    ]);
    const memberName = new Map(memberships.map((m) => [m.id, m.user.displayName]));
    const userName = new Map(users.map((u) => [u.id, u.displayName]));

    return {
      items: page.items.map((r) => {
        const name = r.actorMembershipId
          ? memberName.get(r.actorMembershipId)
          : r.actorUserId
            ? userName.get(r.actorUserId)
            : undefined;
        return {
          id: r.id,
          action: r.action as AuditAction,
          entityType: r.entityType,
          entityId: r.entityId,
          actor: name ? { membershipId: r.actorMembershipId, displayName: name } : null,
          before: r.before ?? null,
          after: r.after ?? null,
          createdAt: r.createdAt.toISOString(),
        };
      }),
      nextCursor: page.nextCursor,
    };
  }
}
