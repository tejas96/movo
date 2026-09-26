import {
  type JoinRequest,
  type JoinSocietyPreviewSchema,
  type joinContract,
  type MemberCard,
  type RouteBody,
  SocietySettingsSchema,
  type societyContract,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import type { Prisma } from '../../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { ContextService } from './context.service';
import { memberInclude, toMemberCard, toSocietySummary } from './mappers';
import { RolesService } from './roles.service';

const requestInclude = {
  user: true,
  flat: { include: { building: true } },
} satisfies Prisma.JoinRequestInclude;
type RequestRow = Prisma.JoinRequestGetPayload<{ include: typeof requestInclude }>;

function toDto(r: RequestRow, showContact: boolean): JoinRequest {
  return {
    id: r.id,
    user: {
      id: r.user.id,
      displayName: r.user.displayName,
      phone: showContact ? r.user.phone : null,
      email: showContact ? r.user.email : null,
    },
    flat: { id: r.flat.id, number: r.flat.number, buildingName: r.flat.building?.name ?? null },
    relationClaimed: r.relationClaimed,
    message: r.message,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

@Injectable()
export class JoinRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantPrismaService,
    private readonly roles: RolesService,
    private readonly audit: AuditService,
    private readonly context: ContextService,
    private readonly notifications: NotificationsService,
  ) {}

  private async societyByJoinCode(rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    const society = await this.prisma.society.findUnique({ where: { joinCode: code } });
    if (society?.status !== 'ACTIVE') throw ApiException.notFound('No society found for this code');
    return society;
  }

  async preview(joinCode: string): Promise<z.infer<typeof JoinSocietyPreviewSchema>> {
    const society = await this.societyByJoinCode(joinCode);
    const settings = SocietySettingsSchema.parse(society.settings ?? {});
    const [buildings, flats] = await Promise.all([
      this.prisma.building.findMany({
        where: { societyId: society.id },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.flat.findMany({
        where: { societyId: society.id, status: { not: 'INACTIVE' } },
        orderBy: { number: 'asc' },
      }),
    ]);
    return {
      society: toSocietySummary(society),
      joinRequestsEnabled: settings.tenancy.joinRequests !== 'OFF',
      buildings: buildings.map((b) => ({ id: b.id, name: b.name })),
      flats: flats.map((f) => ({
        id: f.id,
        number: f.number,
        buildingId: f.buildingId,
        floor: f.floor,
      })),
    };
  }

  async request(userId: string, body: RouteBody<typeof joinContract.request>) {
    const society = await this.societyByJoinCode(body.joinCode);
    const settings = SocietySettingsSchema.parse(society.settings ?? {});
    if (settings.tenancy.joinRequests === 'OFF')
      throw ApiException.forbidden('This society only accepts invited members');
    const flat = await this.prisma.flat.findFirst({
      where: { id: body.flatId, societyId: society.id },
      include: { building: true },
    });
    if (!flat) throw ApiException.notFound('Flat not found');
    const existing = await this.prisma.membership.findUnique({
      where: { societyId_userId: { societyId: society.id, userId } },
    });
    if (existing?.status === 'ACTIVE')
      throw ApiException.conflict('ALREADY_MEMBER', 'You are already a member of this society');
    const pending = await this.prisma.joinRequest.findFirst({
      where: { societyId: society.id, userId, status: 'PENDING' },
    });
    if (pending)
      throw ApiException.conflict(
        'CONFLICT',
        'You already have a pending request for this society',
      );

    const row = await this.prisma.joinRequest.create({
      data: {
        societyId: society.id,
        userId,
        flatId: flat.id,
        relationClaimed: body.relation,
        message: body.message ?? null,
      },
      include: { user: true },
    });
    const approvers = await this.prisma.membership.findMany({
      where: {
        societyId: society.id,
        status: 'ACTIVE',
        roles: { some: { role: { permissions: { some: { permissionKey: 'member.manage' } } } } },
      },
      select: { userId: true },
    });
    await this.notifications.notifyUsers({
      userIds: approvers.map((a) => a.userId),
      societyId: society.id,
      category: 'MEMBERSHIP',
      render: (t) => ({
        title: t('common:push.joinRequestReceived.title'),
        body: t('common:push.joinRequestReceived.body', {
          name: row.user.displayName,
          flat: flat.building ? `${flat.building.name}-${flat.number}` : flat.number,
        }),
      }),
      data: { screen: 'manage/join-requests', societyId: society.id },
    });
    return {
      id: row.id,
      society: toSocietySummary(society),
      flatNumber: flat.number,
      buildingName: flat.building?.name ?? null,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async cancel(userId: string, requestId: string): Promise<void> {
    const row = await this.prisma.joinRequest.findFirst({
      where: { id: requestId, userId, status: 'PENDING' },
    });
    if (!row) throw ApiException.notFound('Request not found');
    await this.prisma.joinRequest.update({
      where: { id: row.id },
      data: { status: 'REJECTED', decisionReason: 'withdrawn by user', decidedAt: new Date() },
    });
  }

  async list(status: JoinRequest['status']): Promise<JoinRequest[]> {
    const rows = await this.tenant.client.joinRequest.findMany({
      where: { status },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => toDto(r, true));
  }

  async approve(
    requestId: string,
    body: RouteBody<typeof societyContract.approveJoinRequest>,
  ): Promise<MemberCard> {
    const ctx = requireTenant();
    const row = await this.tenant.client.joinRequest.findUnique({
      where: { id: requestId },
      include: requestInclude,
    });
    if (row?.status !== 'PENDING') throw ApiException.notFound('Request not found');
    const role = body.roleId
      ? (await this.roles.requireRoles([body.roleId]))[0]
      : await this.roles.residentRole();
    if (!role) throw ApiException.notFound('Role not found');
    const relation = body.relation ?? row.relationClaimed;

    const membership = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.membership.findUnique({
        where: { societyId_userId: { societyId: ctx.societyId, userId: row.userId } },
      });
      const m = existing
        ? await tx.membership.update({
            where: { id: existing.id },
            data: { status: 'ACTIVE', joinedAt: new Date(), leftAt: null },
          })
        : await tx.membership.create({
            data: {
              societyId: ctx.societyId,
              userId: row.userId,
              status: 'ACTIVE',
              joinedAt: new Date(),
            },
          });
      await tx.membershipRole.deleteMany({ where: { membershipId: m.id } });
      await tx.membershipRole.create({ data: { membershipId: m.id, roleId: role.id } });
      await tx.flatOccupancy.create({
        data: {
          societyId: ctx.societyId,
          flatId: row.flatId,
          membershipId: m.id,
          relation,
          isPrimaryContact: false,
        },
      });
      await tx.flat.update({ where: { id: row.flatId }, data: { status: 'OCCUPIED' } });
      await tx.joinRequest.update({
        where: { id: row.id },
        data: {
          status: 'APPROVED',
          decidedByMembershipId: ctx.membershipId,
          decidedAt: new Date(),
        },
      });
      await this.audit.record(
        {
          action: 'join_request.approved',
          entityType: 'JoinRequest',
          entityId: row.id,
          after: { membershipId: m.id, role: role.key, relation },
        },
        tx,
      );
      return tx.membership.findUniqueOrThrow({ where: { id: m.id }, include: memberInclude });
    });
    this.context.invalidateUser(row.userId);
    await this.notifications.notifyUsers({
      userIds: [row.userId],
      societyId: ctx.societyId,
      category: 'MEMBERSHIP',
      render: (t) => ({
        title: t('common:push.membershipApproved.title', { society: ctx.society.name }),
        body: t('common:push.membershipApproved.body'),
      }),
      data: { screen: 'home', societyId: ctx.societyId },
    });
    return toMemberCard(membership, true);
  }

  async reject(requestId: string, reason?: string): Promise<void> {
    const ctx = requireTenant();
    const row = await this.tenant.client.joinRequest.findUnique({ where: { id: requestId } });
    if (row?.status !== 'PENDING') throw ApiException.notFound('Request not found');
    await this.tenant.client.joinRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        decidedByMembershipId: ctx.membershipId,
        decidedAt: new Date(),
        decisionReason: reason ?? null,
      },
    });
    await this.audit.record({
      action: 'join_request.rejected',
      entityType: 'JoinRequest',
      entityId: requestId,
      after: { reason: reason ?? null },
    });
    await this.notifications.notifyUsers({
      userIds: [row.userId],
      societyId: ctx.societyId,
      category: 'MEMBERSHIP',
      render: (t) => ({
        title: t('common:push.membershipRejected.title', { society: ctx.society.name }),
        body: reason ?? t('common:push.membershipRejected.body'),
      }),
      data: { screen: 'join', societyId: ctx.societyId },
    });
  }
}
