import type {
  AttentionItem,
  Expense,
  ExpenseSummary,
  expensesContract,
  RouteBody,
  RouteQuery,
} from '@movo/contracts';
import { formatMoney } from '@movo/i18n';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { isUniqueViolation } from '../../common/errors/prisma-errors';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import { dateOnly, dbDate, fyLabel, iso } from '../../common/util/dates';
import { afterCursor, decodeCursor, slicePage } from '../../common/util/pagination';
import type {
  ExpenseCategory as CategoryRow,
  Expense as ExpenseRow,
  Prisma,
} from '../../generated/prisma/client';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Recipients } from '../notifications/recipients.service';
import { loadMemberNames } from '../tenancy/member-names';
import { checkNotFuture, expensesSettings, isFinanceRole, toCategory } from './expense-rules';

type CreateBody = RouteBody<typeof expensesContract.create>;
type UpdateBody = RouteBody<typeof expensesContract.update>;
type ListQuery = RouteQuery<typeof expensesContract.list>;

type ExpenseWithCategory = ExpenseRow & { category: CategoryRow };

/** Expenses: record, approve or reject, edit until approved. */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly recipients: Recipients,
    private readonly files: FilesService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async list(query: ListQuery) {
    const ctx = requireTenant();
    const finance = this.requireListAccess(ctx);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.db.expense.findMany({
      where: {
        ...(query.fy ? { financialYear: query.fy } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(finance ? (query.status ? { status: query.status } : {}) : { status: 'APPROVED' }),
        ...afterCursor(cursor, 'incurredOn'),
      },
      include: { category: true },
      orderBy: [{ incurredOn: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const page = slicePage(rows, query.limit, (e) => e.incurredOn);
    return { items: page.items.map(toSummary), nextCursor: page.nextCursor };
  }

  async get(expenseId: string): Promise<Expense> {
    const ctx = requireTenant();
    const finance = this.requireListAccess(ctx);
    const e = await this.db.expense.findUnique({
      where: { id: expenseId },
      include: { category: true },
    });
    if (!e || (!finance && e.status !== 'APPROVED'))
      throw ApiException.notFound('Expense not found');
    return this.toDto(ctx, e);
  }

  async create(body: CreateBody): Promise<Expense> {
    const ctx = requireTenant();
    const repeat = await this.db.expense.findFirst({
      where: { idempotencyKey: body.idempotencyKey },
    });
    if (repeat) return this.get(repeat.id);
    await this.requireCategory(body.categoryId);
    checkNotFuture(ctx, body.incurredOn);
    const receiptIds = await this.files.claim(ctx, body.receiptIds ?? [], 'EXPENSE_RECEIPT');
    const status = this.needsApproval(ctx, body.amountPaise) ? 'PENDING' : 'APPROVED';
    let row: ExpenseWithCategory;
    try {
      row = await this.tenant.tx(async (tx) => {
        const e = await tx.expense.create({
          data: {
            societyId: ctx.societyId,
            categoryId: body.categoryId,
            amountPaise: body.amountPaise,
            incurredOn: dbDate(body.incurredOn),
            payeeName: body.payeeName,
            description: body.description || null,
            method: body.method,
            reference: body.reference || null,
            status,
            financialYear: fyLabel(body.incurredOn, ctx.society.fyStartMonth),
            createdByMembershipId: ctx.membershipId,
            idempotencyKey: body.idempotencyKey,
          },
          include: { category: true },
        });
        await this.files.link(tx, receiptIds, { expenseId: e.id });
        await this.audit.record(
          {
            action: 'expense.created',
            entityType: 'Expense',
            entityId: e.id,
            after: { amountPaise: e.amountPaise, payeeName: e.payeeName, status },
          },
          tx,
        );
        if (status === 'PENDING') await this.askApprovers(tx, ctx, e);
        return e;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.db.expense.findFirst({
        where: { idempotencyKey: body.idempotencyKey },
      });
      if (!winner) throw error;
      return this.get(winner.id);
    }
    return this.toDto(ctx, row);
  }

  async update(expenseId: string, body: UpdateBody): Promise<Expense> {
    const ctx = requireTenant();
    const before = await this.requireEditable(ctx, expenseId);
    if (body.categoryId) await this.requireCategory(body.categoryId);
    const incurredOn = body.incurredOn ?? dateOnly(before.incurredOn);
    if (body.incurredOn) checkNotFuture(ctx, body.incurredOn);
    const amountPaise = body.amountPaise ?? before.amountPaise;
    const status = this.needsApproval(ctx, amountPaise) ? 'PENDING' : 'APPROVED';
    const receipts = body.receiptIds
      ? await this.files.plan(
          ctx,
          await this.files.linked({ expenseId }),
          body.receiptIds,
          'EXPENSE_RECEIPT',
        )
      : null;
    const row = await this.tenant.tx(async (tx) => {
      if (receipts) await this.files.link(tx, receipts.final, { expenseId });
      const e = await tx.expense.update({
        where: { id: expenseId, societyId: ctx.societyId },
        data: {
          ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
          ...(body.payeeName !== undefined ? { payeeName: body.payeeName } : {}),
          ...(body.description !== undefined ? { description: body.description || null } : {}),
          ...(body.method !== undefined ? { method: body.method } : {}),
          ...(body.reference !== undefined ? { reference: body.reference || null } : {}),
          amountPaise,
          incurredOn: dbDate(incurredOn),
          financialYear: fyLabel(incurredOn, ctx.society.fyStartMonth),
          status,
          rejectionReason: null,
          decidedByMembershipId: null,
          decidedAt: null,
        },
        include: { category: true },
      });
      await this.audit.record(
        {
          action: 'expense.updated',
          entityType: 'Expense',
          entityId: expenseId,
          before: { amountPaise: before.amountPaise, status: before.status },
          after: { amountPaise, status },
        },
        tx,
      );
      if (status === 'PENDING') await this.askApprovers(tx, ctx, e);
      return e;
    });
    if (receipts) await this.files.remove(receipts.dropped);
    return this.toDto(ctx, row);
  }

  async decide(expenseId: string, approve: boolean, reason?: string): Promise<Expense> {
    const ctx = requireTenant();
    const e = await this.db.expense.findUnique({ where: { id: expenseId } });
    if (!e) throw ApiException.notFound('Expense not found');
    if (e.status !== 'PENDING')
      throw ApiException.conflict('CONFLICT', 'This expense is not waiting for approval');
    if (e.createdByMembershipId === ctx.membershipId)
      throw ApiException.forbidden('Someone else must approve an expense you added');
    const row = await this.tenant.tx(async (tx) => {
      const moved = await tx.expense.updateMany({
        where: { id: expenseId, societyId: ctx.societyId, status: 'PENDING' },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          decidedByMembershipId: ctx.membershipId,
          decidedAt: new Date(),
          rejectionReason: approve ? null : (reason ?? null),
        },
      });
      if (moved.count === 0)
        throw ApiException.conflict('CONFLICT', 'This expense is not waiting for approval');
      const updated = await tx.expense.findUniqueOrThrow({
        where: { id: expenseId },
        include: { category: true },
      });
      await this.audit.record(
        {
          action: approve ? 'expense.approved' : 'expense.rejected',
          entityType: 'Expense',
          entityId: expenseId,
          after: { amountPaise: e.amountPaise, reason: reason ?? null },
        },
        tx,
      );
      await this.notifications.notifyUsers(
        {
          userIds: await this.recipients.in(tx).ofMemberships([e.createdByMembershipId]),
          societyId: ctx.societyId,
          category: 'EXPENSE',
          render: (t, locale) => ({
            title: t(approve ? 'expenses:push.approvedTitle' : 'expenses:push.rejectedTitle', {
              amount: formatMoney(e.amountPaise, locale),
            }),
            body: approve ? e.payeeName : `${e.payeeName} · ${reason ?? ''}`,
          }),
          data: { screen: 'expense', societyId: ctx.societyId, expenseId },
        },
        tx,
      );
      return updated;
    });
    return this.toDto(ctx, row);
  }

  async remove(expenseId: string): Promise<void> {
    const ctx = requireTenant();
    const e = await this.requireEditable(ctx, expenseId);
    const receiptIds = await this.files.linked({ expenseId });
    await this.tenant.tx(async (tx) => {
      await tx.expense.delete({ where: { id: expenseId } });
      await this.audit.record(
        {
          action: 'expense.deleted',
          entityType: 'Expense',
          entityId: expenseId,
          before: { amountPaise: e.amountPaise, payeeName: e.payeeName, status: e.status },
        },
        tx,
      );
    });
    await this.files.remove(receiptIds);
  }

  /** Home: pending expenses this approver may decide. */
  async attentionForHome(ctx: TenantContext): Promise<AttentionItem[]> {
    if (!can(ctx, 'expense.approve')) return [];
    const agg = await this.db.expense.aggregate({
      where: { status: 'PENDING', createdByMembershipId: { not: ctx.membershipId } },
      _count: { _all: true },
      _sum: { amountPaise: true },
    });
    return agg._count._all > 0
      ? [
          {
            type: 'EXPENSES_TO_APPROVE',
            count: agg._count._all,
            amountPaise: agg._sum.amountPaise ?? 0,
          },
        ]
      : [];
  }

  /** true = finance role (all statuses). Members get approved ones only with DETAILED sharing. */
  private requireListAccess(ctx: TenantContext): boolean {
    if (isFinanceRole(ctx)) return true;
    if (expensesSettings(ctx).visibleToMembers === 'DETAILED') return false;
    throw ApiException.forbidden('Your committee shares only a summary of expenses');
  }

  private needsApproval(ctx: TenantContext, amountPaise: number): boolean {
    const s = expensesSettings(ctx);
    return (
      s.approval === 'ALWAYS' ||
      (s.approval === 'ABOVE_AMOUNT' && amountPaise > s.approvalThresholdPaise)
    );
  }

  private async requireCategory(id: string) {
    const c = await this.db.expenseCategory.findUnique({ where: { id } });
    if (!c) throw ApiException.notFound('Category not found');
    return c;
  }

  private async requireEditable(ctx: TenantContext, expenseId: string) {
    const e = await this.db.expense.findUnique({ where: { id: expenseId } });
    if (!e) throw ApiException.notFound('Expense not found');
    if (!this.mayEdit(ctx, e)) {
      if (e.status === 'APPROVED')
        throw ApiException.conflict('CONFLICT', 'An approved expense cannot change');
      throw ApiException.forbidden();
    }
    return e;
  }

  private mayEdit(ctx: TenantContext, e: ExpenseRow): boolean {
    return (
      e.status !== 'APPROVED' &&
      (e.createdByMembershipId === ctx.membershipId || can(ctx, 'expense.approve'))
    );
  }

  private async askApprovers(
    tx: Prisma.TransactionClient,
    ctx: TenantContext,
    e: ExpenseWithCategory,
  ) {
    await this.notifications.notifyUsers(
      {
        userIds: await this.recipients.in(tx).withPermission(ctx.societyId, 'expense.approve', {
          exceptMembershipId: e.createdByMembershipId,
        }),
        societyId: ctx.societyId,
        category: 'EXPENSE',
        render: (t, locale) => ({
          title: t('expenses:push.pendingTitle', { amount: formatMoney(e.amountPaise, locale) }),
          body: `${e.payeeName} · ${e.category.name}`,
        }),
        data: { screen: 'expense', societyId: ctx.societyId, expenseId: e.id },
      },
      tx,
    );
  }

  private async toDto(ctx: TenantContext, e: ExpenseWithCategory): Promise<Expense> {
    const names = await loadMemberNames(this.prisma, [
      e.createdByMembershipId,
      e.decidedByMembershipId,
    ]);
    const actor = (id: string) => ({
      membershipId: id,
      displayName: names.get(id)?.displayName ?? 'Committee',
    });
    return {
      ...toSummary(e),
      method: e.method,
      reference: e.reference,
      financialYear: e.financialYear,
      createdBy: actor(e.createdByMembershipId),
      decidedBy: e.decidedByMembershipId ? actor(e.decidedByMembershipId) : null,
      decidedAt: iso(e.decidedAt),
      rejectionReason: e.rejectionReason,
      createdAt: e.createdAt.toISOString(),
      receipts: (await this.files.linked({ expenseId: e.id })).map((id) => this.files.ref(id)),
      canDecide:
        e.status === 'PENDING' &&
        can(ctx, 'expense.approve') &&
        e.createdByMembershipId !== ctx.membershipId,
      canEdit: this.mayEdit(ctx, e),
    };
  }
}

function toSummary(e: ExpenseWithCategory): ExpenseSummary {
  return {
    id: e.id,
    category: toCategory(e.category),
    amountPaise: e.amountPaise,
    incurredOn: dateOnly(e.incurredOn),
    payeeName: e.payeeName,
    description: e.description,
    status: e.status,
  };
}
