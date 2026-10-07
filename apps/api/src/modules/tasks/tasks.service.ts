import {
  type AttentionItem,
  parseModuleSettings,
  type RouteBody,
  type Task,
  type TaskEventKind,
  type TaskSummary,
  type TaskView,
  type tasksContract,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import type { Prisma, Task as TaskRow, TaskStatus } from '../../generated/prisma/client';
import { FilesService } from '../files/files.service';
import { dateOnly, dbDate } from '../maintenance/ledger';
import { NotificationsService } from '../notifications/notifications.service';
import { awardContext, awardPoints } from '../rewards/rewards.service';
import { loadMemberNames } from '../tenancy/member-names';

type CreateBody = RouteBody<typeof tasksContract.create>;
type UpdateBody = RouteBody<typeof tasksContract.update>;
type Tx = Prisma.TransactionClient;

const LIVE: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'SUBMITTED'];

@Injectable()
export class TasksService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly files: FilesService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async list(view: TaskView): Promise<TaskSummary[]> {
    const ctx = requireTenant();
    if (view === 'TO_VERIFY' && !can(ctx, 'task.verify')) throw ApiException.forbidden();
    const where: Prisma.TaskWhereInput =
      view === 'OPEN'
        ? { status: 'OPEN' }
        : view === 'MINE'
          ? { assigneeMembershipId: ctx.membershipId, status: { in: ['IN_PROGRESS', 'SUBMITTED'] } }
          : view === 'ACTIVE'
            ? { status: { in: ['IN_PROGRESS', 'SUBMITTED'] } }
            : view === 'DONE'
              ? { status: 'COMPLETED' }
              : { status: 'SUBMITTED', assigneeMembershipId: { not: ctx.membershipId } };
    const rows = await this.db.task.findMany({
      where,
      orderBy:
        view === 'DONE'
          ? [{ completedAt: 'desc' }]
          : [{ dueOn: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 100,
    });
    const names = await loadMemberNames(
      this.prisma,
      rows.map((r) => r.assigneeMembershipId),
    );
    return rows.map((r) => toSummary(r, names));
  }

  async get(taskId: string): Promise<Task> {
    const ctx = requireTenant();
    return this.toDto(ctx, await this.requireTask(taskId));
  }

  async create(body: CreateBody): Promise<Task> {
    const ctx = requireTenant();
    if (body.assigneeMembershipId) await this.requireMember(body.assigneeMembershipId);
    const task = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.create({
        data: {
          societyId: ctx.societyId,
          title: body.title,
          description: body.description || null,
          points: body.points,
          dueOn: body.dueOn ? dbDate(body.dueOn) : null,
          assigneeMembershipId: body.assigneeMembershipId ?? null,
          status: body.assigneeMembershipId ? 'IN_PROGRESS' : 'OPEN',
          createdByMembershipId: ctx.membershipId,
        },
      });
      await this.event(tx, ctx, t.id, 'CREATED');
      if (body.assigneeMembershipId) await this.event(tx, ctx, t.id, 'ASSIGNED');
      await this.audit.record(
        {
          action: 'task.created',
          entityType: 'Task',
          entityId: t.id,
          after: { title: t.title, points: t.points },
        },
        tx,
      );
      return t;
    });
    if (task.assigneeMembershipId) await this.tellAssignee(ctx, task, 'assigned');
    return this.toDto(ctx, task);
  }

  async update(taskId: string, body: UpdateBody): Promise<Task> {
    const ctx = requireTenant();
    const before = await this.requireLive(taskId);
    const task = await this.db.task.update({
      where: { id: taskId },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(body.points !== undefined ? { points: body.points } : {}),
        ...(body.dueOn !== undefined ? { dueOn: body.dueOn ? dbDate(body.dueOn) : null } : {}),
      },
    });
    await this.audit.record({
      action: 'task.updated',
      entityType: 'Task',
      entityId: taskId,
      before: { title: before.title, points: before.points },
      after: { title: task.title, points: task.points },
    });
    return this.toDto(ctx, task);
  }

  async assign(taskId: string, membershipId: string | null): Promise<Task> {
    const ctx = requireTenant();
    const before = await this.requireLive(taskId);
    if (membershipId) await this.requireMember(membershipId);
    const task = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.update({
        where: { id: taskId, societyId: ctx.societyId },
        data: {
          assigneeMembershipId: membershipId,
          status: membershipId ? 'IN_PROGRESS' : 'OPEN',
          submissionNote: null,
          submittedAt: null,
        },
      });
      await this.event(tx, ctx, taskId, membershipId ? 'ASSIGNED' : 'WITHDRAWN');
      await this.audit.record(
        {
          action: 'task.assigned',
          entityType: 'Task',
          entityId: taskId,
          before: { assignee: before.assigneeMembershipId },
          after: { assignee: membershipId },
        },
        tx,
      );
      return t;
    });
    if (membershipId && membershipId !== before.assigneeMembershipId)
      await this.tellAssignee(ctx, task, 'assigned');
    return this.toDto(ctx, task);
  }

  async volunteer(taskId: string): Promise<Task> {
    const ctx = requireTenant();
    if (!parseModuleSettings('tasks', ctx.moduleSettings.tasks).volunteeringEnabled)
      throw ApiException.forbidden('Your committee assigns tasks directly');
    const t = await this.requireTask(taskId);
    if (t.status !== 'OPEN')
      throw ApiException.conflict('CONFLICT', 'Someone has already taken this task');
    // Only one volunteer can win a race: the update matches while the task is still open.
    const task = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.task.updateMany({
        where: { id: taskId, societyId: ctx.societyId, status: 'OPEN' },
        data: { assigneeMembershipId: ctx.membershipId, status: 'IN_PROGRESS' },
      });
      if (count === 0)
        throw ApiException.conflict('CONFLICT', 'Someone has already taken this task');
      await this.event(tx, ctx, taskId, 'VOLUNTEERED');
      return tx.task.findUniqueOrThrow({ where: { id: taskId } });
    });
    return this.toDto(ctx, task);
  }

  async withdraw(taskId: string): Promise<Task> {
    const ctx = requireTenant();
    const t = await this.requireTask(taskId);
    if (t.assigneeMembershipId !== ctx.membershipId || t.status !== 'IN_PROGRESS')
      throw ApiException.forbidden('Only the person doing a task can give it back');
    const task = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId, societyId: ctx.societyId },
        data: { assigneeMembershipId: null, status: 'OPEN' },
      });
      await this.event(tx, ctx, taskId, 'WITHDRAWN');
      return updated;
    });
    return this.toDto(ctx, task);
  }

  async submit(
    taskId: string,
    note: string | undefined,
    proofIds: string[] | undefined,
  ): Promise<Task> {
    const ctx = requireTenant();
    const t = await this.requireTask(taskId);
    if (t.assigneeMembershipId !== ctx.membershipId || t.status !== 'IN_PROGRESS')
      throw ApiException.forbidden('Only the person doing a task can mark it done');
    // New photos replace the ones from a try that was sent back; no list keeps them.
    const proofs = proofIds
      ? await this.files.plan(ctx, await this.files.linked({ taskId }), proofIds, 'TASK_PROOF')
      : null;
    const task = await this.prisma.$transaction(async (tx) => {
      if (proofs) await this.files.link(tx, proofs.final, { taskId });
      const updated = await tx.task.update({
        where: { id: taskId, societyId: ctx.societyId },
        data: { status: 'SUBMITTED', submissionNote: note ?? null, submittedAt: new Date() },
      });
      await this.event(tx, ctx, taskId, 'SUBMITTED', note);
      return updated;
    });
    if (proofs) await this.files.remove(proofs.dropped);
    const verifiers = await this.prisma.membership.findMany({
      where: {
        societyId: ctx.societyId,
        status: 'ACTIVE',
        id: { not: ctx.membershipId },
        roles: { some: { role: { permissions: { some: { permissionKey: 'task.verify' } } } } },
      },
      select: { userId: true },
    });
    await this.notifications.notifyUsers({
      userIds: verifiers.map((v) => v.userId),
      societyId: ctx.societyId,
      category: 'TASK',
      render: (tr) => ({
        title: tr('tasks:push.submittedTitle', { title: task.title }),
        body: note ?? '',
      }),
      data: { screen: 'task', societyId: ctx.societyId, taskId },
    });
    return this.toDto(ctx, task);
  }

  async verify(taskId: string): Promise<Task> {
    const ctx = requireTenant();
    const t = await this.requireTask(taskId);
    if (t.status !== 'SUBMITTED')
      throw ApiException.conflict('CONFLICT', 'This task is not waiting for a check');
    if (t.assigneeMembershipId === ctx.membershipId)
      throw ApiException.forbidden('Someone else must check your own task');
    let awarded = 0;
    const task = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId, societyId: ctx.societyId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          verifiedByMembershipId: ctx.membershipId,
        },
      });
      await this.event(tx, ctx, taskId, 'VERIFIED');
      if (ctx.enabledModules.has('rewards') && t.assigneeMembershipId)
        awarded = await awardPoints(tx, {
          ...awardContext(ctx),
          membershipId: t.assigneeMembershipId,
          points: t.points,
          reason: 'TASK',
          label: t.title,
          refType: 'Task',
          refId: t.id,
          byMembershipId: ctx.membershipId,
        });
      await this.audit.record(
        {
          action: 'task.verified',
          entityType: 'Task',
          entityId: taskId,
          after: { points: awarded, assignee: t.assigneeMembershipId },
        },
        tx,
      );
      return updated;
    });
    await this.tellAssignee(ctx, task, 'verified', undefined, awarded);
    return this.toDto(ctx, task);
  }

  async sendBack(taskId: string, reason: string): Promise<Task> {
    const ctx = requireTenant();
    const t = await this.requireTask(taskId);
    if (t.status !== 'SUBMITTED')
      throw ApiException.conflict('CONFLICT', 'This task is not waiting for a check');
    if (t.assigneeMembershipId === ctx.membershipId)
      throw ApiException.forbidden('Someone else must check your own task');
    const task = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId, societyId: ctx.societyId },
        data: { status: 'IN_PROGRESS' },
      });
      await this.event(tx, ctx, taskId, 'RETURNED', reason);
      await this.audit.record(
        { action: 'task.returned', entityType: 'Task', entityId: taskId, after: { reason } },
        tx,
      );
      return updated;
    });
    await this.tellAssignee(ctx, task, 'returned', reason);
    return this.toDto(ctx, task);
  }

  async cancel(taskId: string): Promise<Task> {
    const ctx = requireTenant();
    await this.requireLive(taskId);
    const task = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id: taskId, societyId: ctx.societyId },
        data: { status: 'CANCELLED' },
      });
      await this.event(tx, ctx, taskId, 'CANCELLED');
      await this.audit.record(
        { action: 'task.cancelled', entityType: 'Task', entityId: taskId },
        tx,
      );
      return updated;
    });
    return this.toDto(ctx, task);
  }

  /** Home: my tasks in progress (two at most) and, for checkers, how many wait. */
  async attentionForHome(ctx: TenantContext): Promise<AttentionItem[]> {
    const items: AttentionItem[] = [];
    const mine = await this.db.task.findMany({
      where: { assigneeMembershipId: ctx.membershipId, status: 'IN_PROGRESS' },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: [{ dueOn: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: 2,
    });
    for (const t of mine)
      items.push({
        type: 'MY_TASK',
        taskId: t.id,
        title: t.title,
        dueOn: t.dueOn ? dateOnly(t.dueOn) : null,
        returned: t.events[0]?.kind === 'RETURNED',
      });
    if (can(ctx, 'task.verify')) {
      const count = await this.db.task.count({
        where: { status: 'SUBMITTED', assigneeMembershipId: { not: ctx.membershipId } },
      });
      if (count > 0) items.push({ type: 'TASKS_TO_VERIFY', count });
    }
    return items;
  }

  async openTaskCount(ctx: TenantContext): Promise<number> {
    return this.db.task.count({
      where: {
        assigneeMembershipId: ctx.membershipId,
        status: { in: ['IN_PROGRESS', 'SUBMITTED'] },
      },
    });
  }

  private async event(
    tx: Tx,
    ctx: TenantContext,
    taskId: string,
    kind: TaskEventKind,
    note?: string,
  ) {
    await tx.taskEvent.create({
      data: {
        societyId: ctx.societyId,
        taskId,
        kind,
        note: note ?? null,
        byMembershipId: ctx.membershipId,
      },
    });
  }

  private async tellAssignee(
    ctx: TenantContext,
    t: TaskRow,
    kind: 'assigned' | 'verified' | 'returned',
    reason?: string,
    points = 0,
  ) {
    if (!t.assigneeMembershipId || t.assigneeMembershipId === ctx.membershipId) return;
    const m = await this.prisma.membership.findUnique({
      where: { id: t.assigneeMembershipId },
      select: { userId: true },
    });
    if (!m) return;
    await this.notifications.notifyUsers({
      userIds: [m.userId],
      societyId: ctx.societyId,
      category: 'TASK',
      render: (tr) =>
        kind === 'assigned'
          ? { title: tr('tasks:push.assignedTitle', { title: t.title }), body: t.description ?? '' }
          : kind === 'verified'
            ? {
                title: tr('tasks:push.verifiedTitle', { title: t.title }),
                body: points > 0 ? tr('tasks:push.pointsBody', { count: points }) : '',
              }
            : { title: tr('tasks:push.returnedTitle', { title: t.title }), body: reason ?? '' },
      data: { screen: 'task', societyId: ctx.societyId, taskId: t.id },
    });
  }

  private async requireTask(taskId: string): Promise<TaskRow> {
    const t = await this.db.task.findUnique({ where: { id: taskId } });
    if (!t) throw ApiException.notFound('Task not found');
    return t;
  }

  private async requireLive(taskId: string): Promise<TaskRow> {
    const t = await this.requireTask(taskId);
    if (!LIVE.includes(t.status))
      throw ApiException.conflict('CONFLICT', 'This task is already finished');
    return t;
  }

  private async requireMember(membershipId: string) {
    const m = await this.db.membership.findUnique({ where: { id: membershipId } });
    if (m?.status !== 'ACTIVE') throw ApiException.notFound('Member not found');
  }

  private async toDto(ctx: TenantContext, t: TaskRow): Promise<Task> {
    const events = await this.db.taskEvent.findMany({
      where: { taskId: t.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const names = await loadMemberNames(this.prisma, [
      t.assigneeMembershipId,
      t.createdByMembershipId,
      ...events.map((e) => e.byMembershipId),
    ]);
    const actor = (id: string) => ({
      membershipId: id,
      displayName: names.get(id)?.displayName ?? 'Committee',
    });
    const mine = t.assigneeMembershipId === ctx.membershipId;
    return {
      ...toSummary(t, names),
      description: t.description,
      submissionNote: t.submissionNote,
      proofs: (await this.files.linked({ taskId: t.id })).map((id) => this.files.ref(id)),
      createdBy: actor(t.createdByMembershipId),
      createdAt: t.createdAt.toISOString(),
      events: events.map((e) => ({
        kind: e.kind,
        note: e.note,
        by: actor(e.byMembershipId),
        createdAt: e.createdAt.toISOString(),
      })),
      canVolunteer:
        t.status === 'OPEN' &&
        parseModuleSettings('tasks', ctx.moduleSettings.tasks).volunteeringEnabled,
      canWithdraw: mine && t.status === 'IN_PROGRESS',
      canSubmit: mine && t.status === 'IN_PROGRESS',
      canVerify: t.status === 'SUBMITTED' && can(ctx, 'task.verify') && !mine,
      canManage: can(ctx, 'task.manage') && LIVE.includes(t.status),
    };
  }
}

function toSummary(t: TaskRow, names: Map<string, { displayName: string }>): TaskSummary {
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    points: t.points,
    dueOn: t.dueOn ? dateOnly(t.dueOn) : null,
    assignee: t.assigneeMembershipId
      ? {
          membershipId: t.assigneeMembershipId,
          displayName: names.get(t.assigneeMembershipId)?.displayName ?? '',
        }
      : null,
  };
}
