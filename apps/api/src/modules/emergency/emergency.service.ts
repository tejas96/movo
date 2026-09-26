import {
  type Alert,
  type AlertType,
  type AttentionItem,
  DEFAULT_PUBLIC_EMERGENCY_CONTACTS,
  type EmergencyContact,
  type emergencyContract,
  type RouteBody,
  type RouteQuery,
} from '@movo/contracts';
import type { TFunction } from '@movo/i18n';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import { iso, minutes } from '../../common/util/dates';
import { decodeCursor, slicePage } from '../../common/util/pagination';
import type { Prisma } from '../../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { toFlatRef } from '../tenancy/mappers';
import { loadMemberNames } from '../tenancy/member-names';

type ContactBody = RouteBody<typeof emergencyContract.createContact>;
type ContactPatch = RouteBody<typeof emergencyContract.updateContact>;
type RaiseBody = RouteBody<typeof emergencyContract.raiseAlert>;
type ResolveBody = RouteBody<typeof emergencyContract.resolveAlert>;
type ListQuery = RouteQuery<typeof emergencyContract.listAlerts>;

const alertInclude = { flat: { include: { building: true } } } satisfies Prisma.AlertInclude;
type AlertRow = Prisma.AlertGetPayload<{ include: typeof alertInclude }>;

interface EmergencySettings {
  alertRecipients: 'ALL' | 'ROLES';
  roleIds: string[];
  cooldownMinutes: number;
}

/** Rows for a new society: India's national numbers. */
export function defaultEmergencyContactRows(societyId: string) {
  return DEFAULT_PUBLIC_EMERGENCY_CONTACTS.map((c, i) => ({
    societyId,
    label: c.label,
    phone: c.phone,
    type: c.type,
    sortOrder: 100 + i,
    isPublicNumber: true,
  }));
}

const cleanPhone = (raw: string) => raw.replace(/[\s-]/g, '');

@Injectable()
export class EmergencyService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  private settings(ctx: TenantContext): EmergencySettings {
    const raw = (ctx.moduleSettings.emergency ?? {}) as Partial<EmergencySettings>;
    return {
      alertRecipients: raw.alertRecipients ?? 'ALL',
      roleIds: raw.roleIds ?? [],
      cooldownMinutes: raw.cooldownMinutes ?? 5,
    };
  }

  // ---------- contacts ----------

  async listContacts(): Promise<EmergencyContact[]> {
    const rows = await this.db.emergencyContact.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toContactDto);
  }

  async createContact(body: ContactBody): Promise<EmergencyContact> {
    const ctx = requireTenant();
    const sortOrder = body.sortOrder ?? (await this.db.emergencyContact.count());
    const row = await this.db.emergencyContact.create({
      data: {
        societyId: ctx.societyId,
        label: body.label,
        phone: cleanPhone(body.phone),
        type: body.type,
        sortOrder,
        isPublicNumber: body.isPublicNumber,
      },
    });
    await this.audit.record({
      action: 'emergency.contact.created',
      entityType: 'EmergencyContact',
      entityId: row.id,
      after: { label: row.label, phone: row.phone },
    });
    return toContactDto(row);
  }

  async updateContact(contactId: string, body: ContactPatch): Promise<EmergencyContact> {
    const before = await this.db.emergencyContact.findUnique({ where: { id: contactId } });
    if (!before) throw ApiException.notFound('Contact not found');
    const row = await this.db.emergencyContact.update({
      where: { id: contactId },
      data: {
        ...(body.label !== undefined ? { label: body.label } : {}),
        ...(body.phone !== undefined ? { phone: cleanPhone(body.phone) } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isPublicNumber !== undefined ? { isPublicNumber: body.isPublicNumber } : {}),
      },
    });
    await this.audit.record({
      action: 'emergency.contact.updated',
      entityType: 'EmergencyContact',
      entityId: row.id,
      before: { label: before.label, phone: before.phone },
      after: { label: row.label, phone: row.phone },
    });
    return toContactDto(row);
  }

  async deleteContact(contactId: string): Promise<void> {
    const ctx = requireTenant();
    const row = await this.db.emergencyContact.findUnique({ where: { id: contactId } });
    if (!row) throw ApiException.notFound('Contact not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.emergencyContact.deleteMany({ where: { id: contactId, societyId: ctx.societyId } });
      await this.audit.record(
        {
          action: 'emergency.contact.deleted',
          entityType: 'EmergencyContact',
          entityId: contactId,
          before: { label: row.label, phone: row.phone },
        },
        tx,
      );
    });
  }

  // ---------- alerts ----------

  async listAlerts(query: ListQuery) {
    const ctx = requireTenant();
    const cursor = decodeCursor(query.cursor);
    const rows = await this.db.alert.findMany({
      where: {
        status: query.status === 'ACTIVE' ? 'ACTIVE' : { in: ['RESOLVED', 'FALSE_ALARM'] },
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.at } },
                { createdAt: cursor.at, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: alertInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = slicePage(rows, query.limit);
    return { items: await this.toDtos(ctx, page.items), nextCursor: page.nextCursor };
  }

  async getAlert(alertId: string): Promise<Alert> {
    const ctx = requireTenant();
    const row = await this.requireAlert(alertId);
    return this.toDto(ctx, row);
  }

  async raiseAlert(body: RaiseBody): Promise<Alert> {
    const ctx = requireTenant();
    const settings = this.settings(ctx);
    const recent = await this.db.alert.findFirst({
      where: {
        raisedByMembershipId: ctx.membershipId,
        createdAt: { gt: new Date(Date.now() - minutes(settings.cooldownMinutes)) },
      },
    });
    if (recent)
      throw new ApiException(
        'ALERT_COOLDOWN',
        'You raised an alert moments ago',
        HttpStatus.TOO_MANY_REQUESTS,
        { alertId: recent.id },
      );

    const flatId = body.flatId ?? ctx.flatIds[0] ?? null;
    if (flatId) {
      const flat = await this.db.flat.findUnique({ where: { id: flatId } });
      if (!flat) throw ApiException.notFound('Flat not found');
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const a = await tx.alert.create({
        data: {
          societyId: ctx.societyId,
          source: 'USER',
          type: body.type,
          raisedByMembershipId: ctx.membershipId,
          flatId,
          message: body.message ?? null,
        },
        include: alertInclude,
      });
      await this.audit.record(
        {
          action: 'alert.raised',
          entityType: 'Alert',
          entityId: a.id,
          after: { type: a.type, flatId },
        },
        tx,
      );
      return a;
    });

    const raiser = (await loadMemberNames(this.prisma, [ctx.membershipId])).get(ctx.membershipId);
    const recipients = await this.recipientUserIds(ctx, settings);
    await this.notifications.notifyUsers({
      userIds: recipients.filter((id) => id !== ctx.userId),
      societyId: ctx.societyId,
      category: 'EMERGENCY',
      render: (t) => {
        const vars = this.pushVars(t, row, raiser?.displayName ?? '');
        return {
          title: t('emergency:push.raisedTitle', vars),
          body: row.message
            ? t('emergency:push.raisedBody', { ...vars, message: row.message })
            : t('emergency:push.raisedBodyNoMessage', vars),
        };
      },
      data: {
        screen: 'alert',
        societyId: ctx.societyId,
        alertId: row.id,
        priority: 'EMERGENCY',
      },
    });
    return this.toDto(ctx, row);
  }

  async resolveAlert(alertId: string, body: ResolveBody): Promise<Alert> {
    const ctx = requireTenant();
    const before = await this.requireAlert(alertId);
    if (before.raisedByMembershipId !== ctx.membershipId && !can(ctx, 'emergency.alert.resolve'))
      throw ApiException.forbidden('Only the person who raised it or a resolver can close it');
    if (before.status !== 'ACTIVE')
      throw ApiException.conflict('CONFLICT', 'This alert is already closed');

    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.alert.updateMany({
        where: { id: alertId, societyId: ctx.societyId, status: 'ACTIVE' },
        data: {
          status: body.outcome,
          resolvedAt: new Date(),
          resolvedByMembershipId: ctx.membershipId,
          resolutionNote: body.note ?? null,
        },
      });
      if (updated.count === 0)
        throw ApiException.conflict('CONFLICT', 'This alert is already closed');
      await this.audit.record(
        {
          action: 'alert.resolved',
          entityType: 'Alert',
          entityId: alertId,
          before: { status: 'ACTIVE' },
          after: { status: body.outcome, note: body.note ?? null },
        },
        tx,
      );
      return tx.alert.findUniqueOrThrow({ where: { id: alertId }, include: alertInclude });
    });

    const recipients = await this.recipientUserIds(ctx, this.settings(ctx));
    const raiserUserId = before.raisedByMembershipId
      ? (
          await this.prisma.membership.findUnique({
            where: { id: before.raisedByMembershipId },
            select: { userId: true },
          })
        )?.userId
      : undefined;
    await this.notifications.notifyUsers({
      userIds: [...recipients, ...(raiserUserId ? [raiserUserId] : [])].filter(
        (id) => id !== ctx.userId,
      ),
      societyId: ctx.societyId,
      category: 'EMERGENCY',
      render: (t) => {
        const vars = this.pushVars(t, row, '');
        return {
          title: t('emergency:push.closedTitle', vars),
          body: t('emergency:push.closedBody', {
            ...vars,
            outcome: t(`emergency:status.${body.outcome}`),
          }),
        };
      },
      data: { screen: 'alert', societyId: ctx.societyId, alertId },
    });
    return this.toDto(ctx, row);
  }

  /** Active alerts for Home, newest first. Always rendered first by the app. */
  async attentionForHome(): Promise<AttentionItem[]> {
    const rows = await this.db.alert.findMany({
      where: { status: 'ACTIVE' },
      include: alertInclude,
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    const names = await loadMemberNames(
      this.prisma,
      rows.map((r) => r.raisedByMembershipId),
    );
    return rows.map((a) => ({
      type: 'ACTIVE_ALERT' as const,
      alertId: a.id,
      alertType: a.type,
      flat: a.flat ? toFlatRef(a.flat) : null,
      raisedByName: a.raisedByMembershipId
        ? (names.get(a.raisedByMembershipId)?.displayName ?? null)
        : null,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  /** Everyone active, or the configured roles plus anyone who can resolve alerts. */
  private async recipientUserIds(ctx: TenantContext, s: EmergencySettings): Promise<string[]> {
    const where: Prisma.MembershipWhereInput = { societyId: ctx.societyId, status: 'ACTIVE' };
    if (s.alertRecipients === 'ROLES') {
      where.roles = {
        some: {
          OR: [
            { roleId: { in: s.roleIds } },
            { role: { permissions: { some: { permissionKey: 'emergency.alert.resolve' } } } },
          ],
        },
      };
    }
    const rows = await this.prisma.membership.findMany({ where, select: { userId: true } });
    return rows.map((r) => r.userId);
  }

  private pushVars(t: TFunction, a: AlertRow, name: string) {
    const place = a.flat
      ? a.flat.building
        ? `${a.flat.building.name}-${a.flat.number}`
        : a.flat.number
      : t('emergency:societyPlace');
    return { type: t(`emergency:type.${a.type as AlertType}`), place, name };
  }

  private async requireAlert(alertId: string): Promise<AlertRow> {
    const row = await this.db.alert.findUnique({ where: { id: alertId }, include: alertInclude });
    if (!row) throw ApiException.notFound('Alert not found');
    return row;
  }

  private async toDto(ctx: TenantContext, row: AlertRow): Promise<Alert> {
    const [dto] = await this.toDtos(ctx, [row]);
    if (!dto) throw ApiException.notFound('Alert not found');
    return dto;
  }

  private async toDtos(ctx: TenantContext, rows: AlertRow[]): Promise<Alert[]> {
    const names = await loadMemberNames(
      this.prisma,
      rows.flatMap((r) => [r.raisedByMembershipId, r.resolvedByMembershipId]),
    );
    const resolver = can(ctx, 'emergency.alert.resolve');
    return rows.map((a) => {
      const raiser = a.raisedByMembershipId ? names.get(a.raisedByMembershipId) : undefined;
      const closer = a.resolvedByMembershipId ? names.get(a.resolvedByMembershipId) : undefined;
      return {
        id: a.id,
        type: a.type,
        status: a.status,
        source: a.source,
        message: a.message,
        raisedBy:
          a.raisedByMembershipId && raiser
            ? {
                membershipId: a.raisedByMembershipId,
                displayName: raiser.displayName,
                phone: raiser.phone,
              }
            : null,
        flat: a.flat ? toFlatRef(a.flat) : null,
        createdAt: a.createdAt.toISOString(),
        resolvedAt: iso(a.resolvedAt),
        resolvedBy:
          a.resolvedByMembershipId && closer
            ? { membershipId: a.resolvedByMembershipId, displayName: closer.displayName }
            : null,
        resolutionNote: a.resolutionNote,
        canResolve:
          a.status === 'ACTIVE' && (resolver || a.raisedByMembershipId === ctx.membershipId),
      };
    });
  }
}

function toContactDto(c: {
  id: string;
  label: string;
  phone: string;
  type: EmergencyContact['type'];
  sortOrder: number;
  isPublicNumber: boolean;
}): EmergencyContact {
  return {
    id: c.id,
    label: c.label,
    phone: c.phone,
    type: c.type,
    sortOrder: c.sortOrder,
    isPublicNumber: c.isPublicNumber,
  };
}
