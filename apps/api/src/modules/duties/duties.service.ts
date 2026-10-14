import {
  type AttentionItem,
  type Duty,
  type DutyAssignment,
  type DutyParticipant,
  type DutySummary,
  type dutiesContract,
  parseModuleSettings,
  type RouteBody,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import { dateOnly, dbDate, todayIn } from '../../common/util/dates';
import type { Prisma } from '../../generated/prisma/client';
import { awardContext, awardPoints } from '../rewards/rewards.service';
import { flatLabel } from '../tenancy/mappers';
import { loadMemberNames } from '../tenancy/member-names';
import {
  type AssignmentRow,
  currentTurn,
  type DutyRow,
  type DutyWithParticipants,
  liveWhere,
  participantData,
  participantIdOf,
  plan,
  replaceParticipants,
  replan,
  withParticipants,
} from './duty-plan';
import { DutyTurns } from './duty-turns.service';

type CreateBody = RouteBody<typeof dutiesContract.create>;
type UpdateBody = RouteBody<typeof dutiesContract.update>;
type OverrideBody = RouteBody<typeof dutiesContract.override>;

@Injectable()
export class DutiesService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly turns: DutyTurns,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async list(mineOnly: boolean): Promise<DutySummary[]> {
    const ctx = requireTenant();
    const duties = await this.db.responsibility.findMany({
      where: { status: { not: 'ENDED' } },
      include: withParticipants,
      orderBy: [{ status: 'asc' }, { title: 'asc' }],
    });
    const today = dbDate(todayIn(ctx.society.timezone));
    const rows = await this.db.responsibilityAssignment.findMany({
      where: { responsibilityId: { in: duties.map((d) => d.id) }, ...liveWhere(today) },
      orderBy: { periodIndex: 'asc' },
    });
    const labels = await this.labels(
      duties.flatMap((d) => d.participants),
      rows,
    );
    const out = duties.map((d) => {
      const mine = rows.filter((r) => r.responsibilityId === d.id);
      return this.toSummary(ctx, d, mine, labels);
    });
    if (!mineOnly) return out;
    return out.filter(
      (d) =>
        d.current?.mine ||
        d.next?.mine ||
        duties
          .find((x) => x.id === d.id)
          ?.participants.some((p) => this.isMine(ctx, participantIdOf(p))),
    );
  }

  async get(dutyId: string): Promise<Duty> {
    const ctx = requireTenant();
    return this.toDto(ctx, await this.requireDuty(dutyId));
  }

  async create(body: CreateBody): Promise<Duty> {
    const ctx = requireTenant();
    await this.checkParticipants(body.participantKind, body.participantIds);
    const today = todayIn(ctx.society.timezone);
    const requiresConfirmation =
      body.requiresConfirmation ??
      parseModuleSettings('responsibilities', ctx.moduleSettings.responsibilities)
        .defaultRequiresConfirmation;
    const duty = await this.tenant.tx(async (tx) => {
      const d = await tx.responsibility.create({
        data: {
          societyId: ctx.societyId,
          title: body.title,
          description: body.description || null,
          participantKind: body.participantKind,
          periodUnit: body.periodUnit,
          periodLength: body.periodLength,
          startDate: dbDate(body.startDate),
          requiresConfirmation,
          onMiss: body.onMiss,
          points: body.points ?? null,
          createdByMembershipId: ctx.membershipId,
          participants: {
            create: body.participantIds.map((id, position) => ({
              societyId: ctx.societyId,
              position,
              ...participantData(body.participantKind, id),
            })),
          },
        },
        include: withParticipants,
      });
      await plan(tx, d, today);
      await this.audit.record(
        {
          action: 'duty.created',
          entityType: 'Responsibility',
          entityId: d.id,
          after: { title: d.title, participants: body.participantIds.length },
        },
        tx,
      );
      return d;
    });
    await this.turns.activate(duty, today);
    return this.get(duty.id);
  }

  async update(dutyId: string, body: UpdateBody): Promise<Duty> {
    const before = await this.requireDuty(dutyId);
    await this.db.responsibility.update({
      where: { id: dutyId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.requiresConfirmation !== undefined
          ? { requiresConfirmation: body.requiresConfirmation }
          : {}),
        ...(body.onMiss !== undefined ? { onMiss: body.onMiss } : {}),
        ...(body.points !== undefined ? { points: body.points } : {}),
      },
    });
    await this.audit.record({
      action: 'duty.updated',
      entityType: 'Responsibility',
      entityId: dutyId,
      before: { title: before.title },
      after: body,
    });
    return this.get(dutyId);
  }

  async setParticipants(dutyId: string, ids: string[]): Promise<Duty> {
    const ctx = requireTenant();
    const duty = await this.requireDuty(dutyId);
    await this.checkParticipants(duty.participantKind, ids);
    const today = todayIn(ctx.society.timezone);
    await this.tenant.tx(async (tx) => {
      await replaceParticipants(tx, duty, ids, today);
      await this.audit.record(
        {
          action: 'duty.participants.updated',
          entityType: 'Responsibility',
          entityId: dutyId,
          after: { participants: ids.length },
        },
        tx,
      );
    });
    return this.get(dutyId);
  }

  async setStatus(dutyId: string, status: DutyRow['status']): Promise<Duty> {
    const ctx = requireTenant();
    const duty = await this.requireDuty(dutyId);
    if (duty.status === 'ENDED')
      throw ApiException.conflict('CONFLICT', 'An ended duty cannot restart');
    const today = todayIn(ctx.society.timezone);
    await this.tenant.tx(async (tx) => {
      await tx.responsibility.update({ where: { id: dutyId }, data: { status } });
      if (status === 'ACTIVE') await replan(tx, { ...duty, status }, today);
      else {
        await tx.responsibilityAssignment.deleteMany({
          where: { responsibilityId: dutyId, status: 'UPCOMING' },
        });
        if (status === 'ENDED')
          await tx.responsibilityAssignment.updateMany({
            where: { responsibilityId: dutyId, status: 'ACTIVE' },
            data: { status: 'SKIPPED', overrideNote: 'Duty ended' },
          });
      }
      await this.audit.record(
        {
          action: 'duty.status.updated',
          entityType: 'Responsibility',
          entityId: dutyId,
          before: { status: duty.status },
          after: { status },
        },
        tx,
      );
    });
    if (status === 'ACTIVE') await this.turns.activate(await this.requireDuty(dutyId), today);
    return this.get(dutyId);
  }

  async confirm(dutyId: string, assignmentId: string): Promise<Duty> {
    const ctx = requireTenant();
    const duty = await this.requireDuty(dutyId);
    const row = await this.requireAssignment(dutyId, assignmentId);
    if (row.status !== 'ACTIVE')
      throw ApiException.conflict('CONFLICT', 'Only the current turn can be marked done');
    if (!this.isMine(ctx, participantIdOf(row)) && !can(ctx, 'duty.override'))
      throw ApiException.forbidden('This is not your turn');
    await this.tenant.tx(async (tx) => {
      // Status in the where: a second confirm at the same time finds nothing and awards nothing.
      const moved = await tx.responsibilityAssignment.updateMany({
        where: { id: assignmentId, societyId: ctx.societyId, status: 'ACTIVE' },
        data: {
          status: 'COMPLETED',
          confirmedAt: new Date(),
          confirmedByMembershipId: ctx.membershipId,
        },
      });
      if (moved.count === 0)
        throw ApiException.conflict('CONFLICT', 'Only the current turn can be marked done');
      // Points go to whoever's turn it was, also when the committee marks it done. A flat's
      // turn earns points only for a member of that flat who marks it done themselves.
      const earner =
        row.membershipId ?? (this.isMine(ctx, participantIdOf(row)) ? ctx.membershipId : null);
      const rewards = parseModuleSettings('rewards', ctx.moduleSettings.rewards);
      if (ctx.enabledModules.has('rewards') && rewards.dutiesEarnPoints && duty.points && earner)
        await awardPoints(tx, {
          ...awardContext(ctx),
          membershipId: earner,
          points: duty.points,
          reason: 'DUTY',
          label: duty.title,
          refType: 'ResponsibilityAssignment',
          refId: assignmentId,
          byMembershipId: ctx.membershipId,
        });
      await this.audit.record(
        {
          action: 'duty.confirmed',
          entityType: 'ResponsibilityAssignment',
          entityId: assignmentId,
        },
        tx,
      );
    });
    return this.get(dutyId);
  }

  async override(dutyId: string, assignmentId: string, body: OverrideBody): Promise<Duty> {
    const ctx = requireTenant();
    const duty = await this.requireDuty(dutyId);
    const row = await this.requireAssignment(dutyId, assignmentId);
    const open = row.status === 'UPCOMING' || row.status === 'ACTIVE';
    let data: Prisma.ResponsibilityAssignmentUpdateInput;
    if (body.action === 'SKIP') {
      if (!open) throw ApiException.conflict('CONFLICT', 'This turn is already over');
      data = { status: 'SKIPPED', overrideNote: body.reason };
    } else if (body.action === 'REASSIGN') {
      if (!open) throw ApiException.conflict('CONFLICT', 'This turn is already over');
      if (
        !body.participantId ||
        !duty.participants.some((p) => participantIdOf(p) === body.participantId)
      )
        throw ApiException.validation([
          { path: ['participantId'], message: 'Pick someone from this duty', in: 'body' },
        ]);
      data = {
        ...participantData(duty.participantKind, body.participantId),
        overrideNote: body.reason,
      };
    } else {
      if (row.status !== 'ACTIVE' && row.status !== 'MISSED')
        throw ApiException.conflict(
          'CONFLICT',
          'Only the current or a missed turn can be completed',
        );
      data = {
        status: 'COMPLETED',
        confirmedAt: new Date(),
        confirmedByMembershipId: ctx.membershipId,
        overrideNote: body.reason,
      };
    }
    await this.tenant.tx(async (tx) => {
      await tx.responsibilityAssignment.update({ where: { id: assignmentId }, data });
      await this.audit.record(
        {
          action: 'duty.overridden',
          entityType: 'ResponsibilityAssignment',
          entityId: assignmentId,
          before: { status: row.status, participant: participantIdOf(row) },
          after: {
            action: body.action,
            participant: body.participantId ?? null,
            reason: body.reason,
          },
        },
        tx,
      );
    });
    if (body.action === 'REASSIGN' && row.status === 'ACTIVE' && body.participantId)
      await this.turns.tell(duty, body.participantId, 'start', dateOnly(row.periodEnd));
    return this.get(dutyId);
  }

  /** Home: my current turns. */
  async attentionForHome(ctx: TenantContext): Promise<AttentionItem[]> {
    const rows = await this.db.responsibilityAssignment.findMany({
      where: {
        status: 'ACTIVE',
        responsibility: { status: 'ACTIVE' },
        OR: [{ flatId: { in: ctx.flatIds } }, { membershipId: ctx.membershipId }],
      },
      include: { responsibility: true },
      orderBy: { periodEnd: 'asc' },
      take: 3,
    });
    return rows.map((r) => ({
      type: 'MY_DUTY' as const,
      dutyId: r.responsibilityId,
      assignmentId: r.id,
      title: r.responsibility.title,
      periodEnd: dateOnly(r.periodEnd),
      canConfirm: r.confirmedAt === null,
    }));
  }

  private isMine(ctx: TenantContext, participantId: string): boolean {
    return ctx.flatIds.includes(participantId) || ctx.membershipId === participantId;
  }

  private async checkParticipants(kind: DutyRow['participantKind'], ids: string[]) {
    const found =
      kind === 'FLAT'
        ? await this.db.flat.count({ where: { id: { in: ids }, status: { not: 'INACTIVE' } } })
        : await this.db.membership.count({ where: { id: { in: ids }, status: 'ACTIVE' } });
    if (found !== ids.length)
      throw ApiException.validation([
        {
          path: ['participantIds'],
          message: 'Some participants are not in this society',
          in: 'body',
        },
      ]);
  }

  private async requireDuty(dutyId: string): Promise<DutyWithParticipants> {
    const d = await this.db.responsibility.findUnique({
      where: { id: dutyId },
      include: withParticipants,
    });
    if (!d) throw ApiException.notFound('Duty not found');
    return d;
  }

  private async requireAssignment(dutyId: string, assignmentId: string): Promise<AssignmentRow> {
    const r = await this.db.responsibilityAssignment.findUnique({ where: { id: assignmentId } });
    if (r?.responsibilityId !== dutyId) throw ApiException.notFound('Turn not found');
    return r;
  }

  /** Labels for flats ("A-101") and members (names), keyed by participant id. */
  private async labels(
    participants: { flatId: string | null; membershipId: string | null }[],
    rows: { flatId: string | null; membershipId: string | null }[],
  ): Promise<Map<string, string>> {
    const all = [...participants, ...rows];
    const flatIds = [...new Set(all.map((p) => p.flatId).filter((x): x is string => Boolean(x)))];
    const memberIds = all.map((p) => p.membershipId);
    const [flats, names] = await Promise.all([
      flatIds.length
        ? this.db.flat.findMany({ where: { id: { in: flatIds } }, include: { building: true } })
        : [],
      loadMemberNames(this.prisma, memberIds),
    ]);
    const out = new Map<string, string>();
    for (const f of flats) out.set(f.id, flatLabel(f));
    for (const [id, n] of names) out.set(id, n.displayName);
    return out;
  }

  private toAssignment(
    ctx: TenantContext,
    r: AssignmentRow,
    labels: Map<string, string>,
    names: Map<string, { displayName: string }> = new Map(),
  ): DutyAssignment {
    const pid = participantIdOf(r);
    const participant: DutyParticipant = { id: pid, label: labels.get(pid) ?? '' };
    return {
      id: r.id,
      periodIndex: r.periodIndex,
      periodStart: dateOnly(r.periodStart),
      periodEnd: dateOnly(r.periodEnd),
      participant,
      status: r.status,
      confirmedAt: r.confirmedAt ? r.confirmedAt.toISOString() : null,
      confirmedBy: r.confirmedByMembershipId
        ? {
            membershipId: r.confirmedByMembershipId,
            displayName: names.get(r.confirmedByMembershipId)?.displayName ?? '',
          }
        : null,
      overrideNote: r.overrideNote,
      mine: this.isMine(ctx, pid),
    };
  }

  private toSummary(
    ctx: TenantContext,
    d: DutyWithParticipants,
    rows: AssignmentRow[],
    labels: Map<string, string>,
  ): DutySummary {
    const current = currentTurn(d, rows);
    const next = rows.find((r) => r.status === 'UPCOMING');
    return {
      id: d.id,
      title: d.title,
      participantKind: d.participantKind,
      periodUnit: d.periodUnit,
      periodLength: d.periodLength,
      requiresConfirmation: d.requiresConfirmation,
      status: d.status,
      points: d.points,
      current: current ? this.toAssignment(ctx, current, labels) : null,
      next: next ? this.toAssignment(ctx, next, labels) : null,
    };
  }

  private async toDto(ctx: TenantContext, d: DutyWithParticipants): Promise<Duty> {
    const today = dbDate(todayIn(ctx.society.timezone));
    const [live, past] = await Promise.all([
      this.db.responsibilityAssignment.findMany({
        where: { responsibilityId: d.id, ...liveWhere(today) },
        orderBy: { periodIndex: 'asc' },
      }),
      this.db.responsibilityAssignment.findMany({
        where: { responsibilityId: d.id, status: { in: ['COMPLETED', 'MISSED', 'SKIPPED'] } },
        orderBy: { periodIndex: 'desc' },
        take: 13,
      }),
    ]);
    const current = currentTurn(d, live);
    // The current turn shows on its own card, even once it is done.
    const history = past.filter((r) => r.id !== current?.id).slice(0, 12);
    const labels = await this.labels(d.participants, [...live, ...history]);
    const names = await loadMemberNames(
      this.prisma,
      [...live, ...history].map((r) => r.confirmedByMembershipId),
    );
    const summary = this.toSummary(ctx, d, live, labels);
    return {
      ...summary,
      current: current ? this.toAssignment(ctx, current, labels, names) : null,
      description: d.description,
      startDate: dateOnly(d.startDate),
      onMiss: d.onMiss,
      participants: d.participants.map((p) => ({
        id: participantIdOf(p),
        label: labels.get(participantIdOf(p)) ?? '',
      })),
      upcoming: live
        .filter((r) => r.status === 'UPCOMING')
        .slice(0, 6)
        .map((r) => this.toAssignment(ctx, r, labels)),
      history: history.map((r) => this.toAssignment(ctx, r, labels, names)),
      createdAt: d.createdAt.toISOString(),
    };
  }
}
