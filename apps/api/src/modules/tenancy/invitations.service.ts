import type { Invitation, RouteBody, RouteQuery, societyContract } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { readableCode } from '../../common/util/codes';
import { addMs, days } from '../../common/util/dates';
import { decodeCursor, slicePage } from '../../common/util/pagination';
import type { Prisma } from '../../generated/prisma/client';
import { ContextService } from './context.service';
import { toSocietySummary } from './mappers';
import { RolesService } from './roles.service';

const invitationInclude = {
  flat: { include: { building: true } },
  role: true,
} satisfies Prisma.InvitationInclude;
type InvitationRow = Prisma.InvitationGetPayload<{ include: typeof invitationInclude }> & {
  invitedByName: string;
};

@Injectable()
export class InvitationsService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
    private readonly context: ContextService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  private async toDto(
    row: Prisma.InvitationGetPayload<{ include: typeof invitationInclude }>,
  ): Promise<Invitation> {
    const inviter = await this.prisma.membership.findUnique({
      where: { id: row.invitedByMembershipId },
      include: { user: true },
    });
    return this.toDtoWithName({ ...row, invitedByName: inviter?.user.displayName ?? 'Admin' });
  }

  private toDtoWithName(row: InvitationRow): Invitation {
    const status = row.status === 'PENDING' && row.expiresAt < new Date() ? 'EXPIRED' : row.status;
    return {
      id: row.id,
      code: row.code,
      inviteeName: row.inviteeName,
      phone: row.phone,
      email: row.email,
      flat: row.flat
        ? {
            id: row.flat.id,
            number: row.flat.number,
            buildingName: row.flat.building?.name ?? null,
          }
        : null,
      role: { id: row.role.id, key: row.role.key, name: row.role.name },
      relation: row.relation,
      status,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      invitedBy: { membershipId: row.invitedByMembershipId, displayName: row.invitedByName },
    };
  }

  async list(query: RouteQuery<typeof societyContract.listInvitations>) {
    const cursor = decodeCursor(query.cursor);
    const rows = await this.db.invitation.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.at } },
                { createdAt: cursor.at, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: invitationInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = slicePage(rows, query.limit);
    const inviterIds = [...new Set(page.items.map((r) => r.invitedByMembershipId))];
    const inviters = await this.prisma.membership.findMany({
      where: { id: { in: inviterIds } },
      include: { user: true },
    });
    const nameById = new Map(inviters.map((m) => [m.id, m.user.displayName]));
    return {
      items: page.items.map((r) =>
        this.toDtoWithName({
          ...r,
          invitedByName: nameById.get(r.invitedByMembershipId) ?? 'Admin',
        }),
      ),
      nextCursor: page.nextCursor,
    };
  }

  async create(body: RouteBody<typeof societyContract.createInvitation>): Promise<Invitation> {
    const ctx = requireTenant();
    const role = body.roleId
      ? (await this.roles.requireRoles([body.roleId]))[0]
      : await this.roles.residentRole();
    if (!role) throw ApiException.notFound('Role not found');
    if (body.flatId) {
      const flat = await this.db.flat.findUnique({ where: { id: body.flatId } });
      if (!flat) throw ApiException.notFound('Flat not found');
    }
    let code = readableCode(8);
    for (let i = 0; i < 10; i++) {
      const hit = await this.prisma.invitation.findUnique({ where: { code } });
      if (!hit) break;
      code = readableCode(8);
    }
    const row = await this.db.invitation.create({
      data: {
        societyId: ctx.societyId,
        code,
        inviteeName: body.inviteeName,
        phone: body.phone ?? null,
        email: body.email?.toLowerCase() ?? null,
        flatId: body.flatId ?? null,
        roleId: role.id,
        relation: body.relation,
        invitedByMembershipId: ctx.membershipId,
        expiresAt: addMs(new Date(), days(body.expiresInDays)),
      },
      include: invitationInclude,
    });
    await this.audit.record({
      action: 'invitation.created',
      entityType: 'Invitation',
      entityId: row.id,
      after: { inviteeName: row.inviteeName, flatId: row.flatId, role: role.key },
    });
    return this.toDto(row);
  }

  async revoke(invitationId: string): Promise<void> {
    const row = await this.db.invitation.findUnique({ where: { id: invitationId } });
    if (!row) throw ApiException.notFound('Invitation not found');
    if (row.status !== 'PENDING')
      throw ApiException.conflict('CONFLICT', 'Invitation is not pending');
    await this.db.invitation.update({ where: { id: invitationId }, data: { status: 'REVOKED' } });
    await this.audit.record({
      action: 'invitation.revoked',
      entityType: 'Invitation',
      entityId: invitationId,
    });
  }

  /** Platform scope: the joining user is not a member yet, so there is no tenant context. */
  async accept(userId: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    const invitation = await this.prisma.invitation.findUnique({
      where: { code },
      include: { society: true, role: true, flat: true },
    });
    if (invitation?.status !== 'PENDING')
      throw ApiException.badRequest('INVITE_CODE_INVALID', 'This invite code is not valid');
    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw ApiException.badRequest('INVITE_EXPIRED', 'This invite has expired');
    }
    const existing = await this.prisma.membership.findUnique({
      where: { societyId_userId: { societyId: invitation.societyId, userId } },
    });
    if (existing && existing.status === 'ACTIVE')
      throw ApiException.conflict('ALREADY_MEMBER', 'You are already a member of this society');

    const membership = await this.prisma.$transaction(async (tx) => {
      const m = existing
        ? await tx.membership.update({
            where: { id: existing.id },
            data: { status: 'ACTIVE', joinedAt: new Date(), leftAt: null },
          })
        : await tx.membership.create({
            data: {
              societyId: invitation.societyId,
              userId,
              status: 'ACTIVE',
              joinedAt: new Date(),
            },
          });
      await tx.membershipRole.deleteMany({ where: { membershipId: m.id } });
      await tx.membershipRole.create({ data: { membershipId: m.id, roleId: invitation.roleId } });
      if (invitation.flatId) {
        await tx.flatOccupancy.create({
          data: {
            societyId: invitation.societyId,
            flatId: invitation.flatId,
            membershipId: m.id,
            relation: invitation.relation,
            isPrimaryContact: false,
          },
        });
        await tx.flat.update({ where: { id: invitation.flatId }, data: { status: 'OCCUPIED' } });
      }
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedMembershipId: m.id, acceptedAt: new Date() },
      });
      await this.audit.record(
        {
          action: 'invitation.accepted',
          entityType: 'Invitation',
          entityId: invitation.id,
          societyId: invitation.societyId,
          after: { membershipId: m.id },
        },
        tx,
      );
      return m;
    });
    this.context.invalidateUser(userId);
    return { membershipId: membership.id, society: toSocietySummary(invitation.society) };
  }
}
