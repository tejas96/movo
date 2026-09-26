import type { MemberCard, RouteBody, RouteQuery, societyContract } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can } from '../../common/tenant/tenant.types';
import { decodeCursor, slicePage } from '../../common/util/pagination';
import type { Prisma } from '../../generated/prisma/client';
import { AuthService } from '../identity/auth.service';
import { ContextService } from './context.service';
import { isStaffMembership, memberInclude, toMemberCard } from './mappers';
import { RolesService } from './roles.service';

type ListQuery = RouteQuery<typeof societyContract.listMembers>;

@Injectable()
export class MembersService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
    private readonly context: ContextService,
    private readonly auth: AuthService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  private viewerSeesContact(): boolean {
    return can(requireTenant(), 'member.view_contact');
  }

  async list(query: ListQuery) {
    const ctx = requireTenant();
    const cursor = decodeCursor(query.cursor);
    const staffVisible =
      Boolean(
        (ctx.moduleSettings.directory as { staffVisible?: boolean } | undefined)?.staffVisible,
      ) || can(ctx, 'member.manage');
    const where: Prisma.MembershipWhereInput = {
      status: query.status ?? 'ACTIVE',
      ...(query.q ? { user: { displayName: { contains: query.q, mode: 'insensitive' } } } : {}),
      ...(query.buildingId
        ? { occupancies: { some: { toDate: null, flat: { buildingId: query.buildingId } } } }
        : {}),
      ...(cursor
        ? {
            OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }],
          }
        : {}),
    };
    // Fetch a little extra so hidden staff rows do not shrink the page.
    const rows = await this.db.membership.findMany({
      where,
      include: memberInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 10,
    });
    const visible = staffVisible
      ? rows
      : rows.filter((m) => !isStaffMembership(m) || m.id === ctx.membershipId);
    const page = slicePage(visible, query.limit);
    const seesContact = this.viewerSeesContact();
    return {
      items: page.items.map((m) => toMemberCard(m, seesContact || m.id === ctx.membershipId)),
      nextCursor: page.nextCursor,
    };
  }

  async get(membershipId: string): Promise<MemberCard> {
    const ctx = requireTenant();
    const m = await this.db.membership.findUnique({
      where: { id: membershipId },
      include: memberInclude,
    });
    if (!m || m.status === 'LEFT') throw ApiException.notFound('Member not found');
    return toMemberCard(m, this.viewerSeesContact() || m.id === ctx.membershipId);
  }

  async update(
    membershipId: string,
    body: RouteBody<typeof societyContract.updateMember>,
  ): Promise<MemberCard> {
    const ctx = requireTenant();
    const before = await this.db.membership.findUnique({
      where: { id: membershipId },
      include: memberInclude,
    });
    if (!before) throw ApiException.notFound('Member not found');

    if (body.roleIds) {
      const roles = await this.roles.requireRoles(body.roleIds);
      const keepsRoleManage = roles.some((r) => r.key === 'admin');
      if (!keepsRoleManage && before.roles.some((r) => r.role.key === 'admin'))
        await this.assertNotLastAdmin(membershipId);
    }
    if (body.status && body.status !== 'ACTIVE' && before.roles.some((r) => r.role.key === 'admin'))
      await this.assertNotLastAdmin(membershipId);
    if (membershipId === ctx.membershipId && body.status && body.status !== 'ACTIVE') {
      throw ApiException.forbidden('You cannot suspend or remove yourself');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (body.roleIds) {
        await tx.membershipRole.deleteMany({ where: { membershipId } });
        await tx.membershipRole.createMany({
          data: body.roleIds.map((roleId) => ({ membershipId, roleId })),
        });
      }
      const m = await tx.membership.update({
        where: { id: membershipId, societyId: ctx.societyId },
        data: body.status
          ? { status: body.status, ...(body.status === 'LEFT' ? { leftAt: new Date() } : {}) }
          : {},
        include: memberInclude,
      });
      if (body.status === 'LEFT') {
        await tx.flatOccupancy.updateMany({
          where: { membershipId, toDate: null },
          data: { toDate: new Date() },
        });
      }
      await this.audit.record(
        {
          action: body.roleIds ? 'member.roles.updated' : 'member.status.updated',
          entityType: 'Membership',
          entityId: membershipId,
          before: { roles: before.roles.map((r) => r.role.key), status: before.status },
          after: { roles: m.roles.map((r) => r.role.key), status: m.status },
        },
        tx,
      );
      return m;
    });
    this.context.invalidateUser(updated.userId);
    return toMemberCard(updated, true);
  }

  async setOccupancies(
    membershipId: string,
    body: RouteBody<typeof societyContract.setOccupancies>,
  ): Promise<MemberCard> {
    const ctx = requireTenant();
    const m = await this.db.membership.findUnique({
      where: { id: membershipId },
      include: memberInclude,
    });
    if (!m) throw ApiException.notFound('Member not found');
    const flatIds = body.flats.map((f) => f.flatId);
    if (flatIds.length) {
      const found = await this.db.flat.count({ where: { id: { in: flatIds } } });
      if (found !== new Set(flatIds).size) throw ApiException.notFound('Flat not found');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.flatOccupancy.updateMany({
        where: { membershipId, toDate: null },
        data: { toDate: new Date() },
      });
      if (body.flats.length) {
        await tx.flatOccupancy.createMany({
          data: body.flats.map((f) => ({
            societyId: ctx.societyId,
            flatId: f.flatId,
            membershipId,
            relation: f.relation,
            isPrimaryContact: f.isPrimaryContact,
          })),
        });
        await tx.flat.updateMany({ where: { id: { in: flatIds } }, data: { status: 'OCCUPIED' } });
      }
      await this.refreshVacancy(
        tx,
        ctx.societyId,
        m.occupancies.map((o) => o.flatId),
      );
      await this.audit.record(
        {
          action: 'member.occupancy.updated',
          entityType: 'Membership',
          entityId: membershipId,
          before: { flats: m.occupancies.map((o) => o.flat.number) },
          after: { flats: body.flats },
        },
        tx,
      );
      return tx.membership.findUniqueOrThrow({
        where: { id: membershipId },
        include: memberInclude,
      });
    });
    this.context.invalidateUser(updated.userId);
    return toMemberCard(updated, true);
  }

  /** Flats that lost their last occupant go back to VACANT. */
  private async refreshVacancy(
    tx: Prisma.TransactionClient,
    societyId: string,
    flatIds: string[],
  ): Promise<void> {
    for (const flatId of flatIds) {
      const remaining = await tx.flatOccupancy.count({ where: { flatId, toDate: null } });
      if (remaining === 0)
        await tx.flat.updateMany({ where: { id: flatId, societyId }, data: { status: 'VACANT' } });
    }
  }

  async issueResetCode(membershipId: string) {
    const ctx = requireTenant();
    const m = await this.db.membership.findUnique({
      where: { id: membershipId },
      include: { user: true },
    });
    if (!m || m.status === 'LEFT') throw ApiException.notFound('Member not found');
    const { code, expiresAt } = await this.auth.issueAdminResetCode(m.userId, ctx.userId);
    await this.audit.record({
      action: 'member.reset_code.issued',
      entityType: 'Membership',
      entityId: membershipId,
    });
    return { code, expiresAt: expiresAt.toISOString() };
  }

  async updateMyPrivacy(body: RouteBody<typeof societyContract.updateMyPrivacy>) {
    const ctx = requireTenant();
    const allowPhone =
      (ctx.moduleSettings.directory as { allowPhoneOptIn?: boolean } | undefined)
        ?.allowPhoneOptIn ?? true;
    const m = await this.db.membership.update({
      where: { id: ctx.membershipId },
      data: {
        ...(body.showPhone !== undefined
          ? { privacyShowPhone: allowPhone ? body.showPhone : false }
          : {}),
        ...(body.showEmail !== undefined ? { privacyShowEmail: body.showEmail } : {}),
      },
    });
    return { showPhone: m.privacyShowPhone, showEmail: m.privacyShowEmail };
  }

  private async assertNotLastAdmin(membershipId: string): Promise<void> {
    const others = await this.db.membership.count({
      where: {
        id: { not: membershipId },
        status: 'ACTIVE',
        roles: { some: { role: { key: 'admin' } } },
      },
    });
    if (others === 0)
      throw ApiException.conflict('LAST_ADMIN', 'A society must keep at least one admin');
  }
}
