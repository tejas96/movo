import {
  type MemberCard,
  type MemberDetail,
  type PermissionKey,
  parseModuleSettings,
  type RouteBody,
  type RouteQuery,
  societyContract,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { Lifecycle } from '../../common/lifecycle/lifecycle';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { lockFor } from '../../common/prisma/tx-lock';
import { requireTenant } from '../../common/request-store';
import { can, mayCall } from '../../common/tenant/tenant.types';
import { afterCursor, decodeCursor, slicePage } from '../../common/util/pagination';
import type { Prisma } from '../../generated/prisma/client';
import { AuthService } from '../identity/auth.service';
import { toVehicleDto } from '../parking/parking.service';
import { seesAllVehicles } from '../parking/visibility';
import { ContextService } from './context.service';
import { isStaffMembership, memberInclude, toMemberCard } from './mappers';
import { assertCanGrant, RolesService } from './roles.service';

type ListQuery = RouteQuery<typeof societyContract.listMembers>;

@Injectable()
export class MembersService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
    private readonly context: ContextService,
    private readonly auth: AuthService,
    private readonly lifecycle: Lifecycle,
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
      parseModuleSettings('directory', ctx.moduleSettings.directory).staffVisible ||
      can(ctx, 'member.manage');
    const where: Prisma.MembershipWhereInput = {
      status: query.status ?? 'ACTIVE',
      ...(query.q ? { user: { displayName: { contains: query.q, mode: 'insensitive' } } } : {}),
      ...(query.buildingId
        ? { occupancies: { some: { toDate: null, flat: { buildingId: query.buildingId } } } }
        : {}),
      ...afterCursor(cursor),
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

  async get(membershipId: string): Promise<MemberDetail> {
    const ctx = requireTenant();
    const m = await this.db.membership.findUnique({
      where: { id: membershipId },
      include: memberInclude,
    });
    if (!m || m.status === 'LEFT') throw ApiException.notFound('Member not found');
    const showVehicles =
      ctx.enabledModules.has('parking') && (m.id === ctx.membershipId || seesAllVehicles(ctx));
    const flatIds = m.occupancies.map((o) => o.flatId);
    const vehicles = showVehicles
      ? await this.db.vehicle.findMany({
          where: { flatId: { in: flatIds } },
          include: { flat: { include: { building: true } } },
          orderBy: { createdAt: 'asc' },
        })
      : null;
    return {
      ...toMemberCard(m, this.viewerSeesContact() || m.id === ctx.membershipId),
      vehicles: vehicles ? vehicles.map(toVehicleDto) : null,
      // The member admin routes; members do not manage themselves here (see update).
      canManage: m.id !== ctx.membershipId && mayCall(ctx, societyContract.updateMember),
    };
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
      const added = roles.filter((r) => !before.roles.some((b) => b.roleId === r.id));
      assertCanGrant(
        added.flatMap((r) => r.permissions.map((p) => p.permissionKey as PermissionKey)),
      );
      const keepsRoleManage = roles.some((r) => r.key === 'admin');
      if (!keepsRoleManage && before.roles.some((r) => r.role.key === 'admin'))
        await this.assertNotLastAdmin(membershipId);
    }
    if (body.status && body.status !== 'ACTIVE' && before.roles.some((r) => r.role.key === 'admin'))
      await this.assertNotLastAdmin(membershipId);
    if (membershipId === ctx.membershipId && body.status && body.status !== 'ACTIVE') {
      throw ApiException.forbidden('You cannot suspend or remove yourself');
    }

    const updated = await this.tenant.tx(async (tx) => {
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
      if (body.status === 'LEFT' && before.status !== 'LEFT')
        await this.endMembership(tx, ctx.societyId, membershipId, m.userId);
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

  /**
   * The caller leaves this society: status LEFT, flats end and their work is handed back, the
   * same as an admin removal. The last active admin cannot leave.
   */
  async leave(): Promise<void> {
    const ctx = requireTenant();
    const me = await this.db.membership.findUniqueOrThrow({
      where: { id: ctx.membershipId },
      include: memberInclude,
    });
    const isAdmin = me.roles.some((r) => r.role.key === 'admin');
    await this.tenant.tx(async (tx) => {
      // Two admins leaving at once must not both pass the last-admin check.
      await lockFor(tx, `society-admins:${ctx.societyId}`);
      if (isAdmin) await this.assertNotLastAdmin(me.id, tx);
      const moved = await tx.membership.updateMany({
        where: { id: me.id, societyId: ctx.societyId, status: 'ACTIVE' },
        data: { status: 'LEFT', leftAt: new Date() },
      });
      if (moved.count === 0)
        throw ApiException.conflict('CONFLICT', 'You are no longer a member of this society');
      await this.endMembership(tx, ctx.societyId, me.id, me.userId);
      await this.audit.record(
        {
          action: 'member.left',
          entityType: 'Membership',
          entityId: me.id,
          before: { roles: me.roles.map((r) => r.role.key), status: me.status },
          after: { status: 'LEFT' },
        },
        tx,
      );
    });
    this.context.invalidateUser(me.userId);
  }

  /** A membership ended (admin removal or leaving): flats end, the member's work is handed back. */
  private async endMembership(
    tx: Prisma.TransactionClient,
    societyId: string,
    membershipId: string,
    userId: string,
  ): Promise<void> {
    await tx.flatOccupancy.updateMany({
      where: { membershipId, toDate: null },
      data: { toDate: new Date() },
    });
    await this.lifecycle.memberLeft(tx, { membershipId, societyId, userId, reason: 'left' });
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
    const updated = await this.tenant.tx(async (tx) => {
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

  async getMyPrivacy() {
    const ctx = requireTenant();
    const m = await this.db.membership.findUniqueOrThrow({ where: { id: ctx.membershipId } });
    const allowPhone = parseModuleSettings(
      'directory',
      ctx.moduleSettings.directory,
    ).allowPhoneOptIn;
    return {
      showPhone: allowPhone && m.privacyShowPhone,
      showEmail: m.privacyShowEmail,
      phoneOptInAllowed: allowPhone,
    };
  }

  async updateMyPrivacy(body: RouteBody<typeof societyContract.updateMyPrivacy>) {
    const ctx = requireTenant();
    const allowPhone = parseModuleSettings(
      'directory',
      ctx.moduleSettings.directory,
    ).allowPhoneOptIn;
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

  private async assertNotLastAdmin(
    membershipId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const ctx = requireTenant();
    const others = await (tx ?? this.db).membership.count({
      where: {
        societyId: ctx.societyId,
        id: { not: membershipId },
        status: 'ACTIVE',
        roles: { some: { role: { key: 'admin' } } },
      },
    });
    if (others === 0)
      throw ApiException.conflict('LAST_ADMIN', 'A society must keep at least one admin');
  }
}
