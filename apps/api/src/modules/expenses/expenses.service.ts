import {
  type AttentionItem,
  DEFAULT_EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
  type ExpenseSummary,
  type expensesContract,
  type IncomeEntry,
  parseModuleSettings,
  type RouteBody,
  type RouteQuery,
  VendorCategoryIconSchema,
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
import { iso } from '../../common/util/dates';
import { decodeCursor, encodeCursor } from '../../common/util/pagination';
import type {
  ExpenseCategory as CategoryRow,
  Expense as ExpenseRow,
} from '../../generated/prisma/client';
import { FilesService } from '../files/files.service';
import { fyLabel, todayIn } from '../maintenance/billing';
import { dateOnly, dbDate } from '../maintenance/ledger';
import { NotificationsService } from '../notifications/notifications.service';
import { loadMemberNames } from '../tenancy/member-names';

type CreateBody = RouteBody<typeof expensesContract.create>;
type UpdateBody = RouteBody<typeof expensesContract.update>;
type ListQuery = RouteQuery<typeof expensesContract.list>;
type IncomeBody = RouteBody<typeof expensesContract.createIncome>;

type ExpenseWithCategory = ExpenseRow & { category: CategoryRow };

/** Rows for a new society. */
export function defaultExpenseCategoryRows(societyId: string) {
  return DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
    societyId,
    key: c.key,
    name: c.name,
    icon: c.icon,
    sortOrder: i,
  }));
}

/** Anyone who handles society money sees every expense, whatever the member setting says. */
export function isFinanceRole(ctx: TenantContext): boolean {
  return (
    can(ctx, 'finance.reports.view') || can(ctx, 'expense.create') || can(ctx, 'expense.approve')
  );
}

export function expensesSettings(ctx: TenantContext) {
  return parseModuleSettings('expenses', ctx.moduleSettings.expenses);
}

@Injectable()
export class ExpensesService {
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

  // ---------- categories ----------

  async listCategories(): Promise<ExpenseCategory[]> {
    const rows = await this.db.expenseCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toCategory);
  }

  async createCategory(name: string, icon: string): Promise<ExpenseCategory> {
    const ctx = requireTenant();
    const count = await this.db.expenseCategory.count();
    try {
      const row = await this.db.expenseCategory.create({
        data: { societyId: ctx.societyId, name, icon, sortOrder: count },
      });
      await this.audit.record({
        action: 'expense.category.created',
        entityType: 'ExpenseCategory',
        entityId: row.id,
        after: { name },
      });
      return toCategory(row);
    } catch (error) {
      if (isUniqueViolation(error))
        throw ApiException.conflict('CONFLICT', 'A category with this name exists');
      throw error;
    }
  }

  async updateCategory(id: string, body: { name?: string; icon?: string }) {
    const before = await this.db.expenseCategory.findUnique({ where: { id } });
    if (!before) throw ApiException.notFound('Category not found');
    try {
      const row = await this.db.expenseCategory.update({
        where: { id },
        // A renamed seeded category shows the new name, not the translation.
        data: {
          ...(body.name !== undefined ? { name: body.name, key: null } : {}),
          ...(body.icon !== undefined ? { icon: body.icon } : {}),
        },
      });
      await this.audit.record({
        action: 'expense.category.updated',
        entityType: 'ExpenseCategory',
        entityId: id,
        before: { name: before.name },
        after: { name: row.name },
      });
      return toCategory(row);
    } catch (error) {
      if (isUniqueViolation(error))
        throw ApiException.conflict('CONFLICT', 'A category with this name exists');
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<void> {
    const row = await this.db.expenseCategory.findUnique({ where: { id } });
    if (!row) throw ApiException.notFound('Category not found');
    if ((await this.db.expense.count({ where: { categoryId: id } })) > 0)
      throw ApiException.conflict('CATEGORY_NOT_EMPTY', 'Move or remove its expenses first');
    await this.db.expenseCategory.delete({ where: { id } });
    await this.audit.record({
      action: 'expense.category.deleted',
      entityType: 'ExpenseCategory',
      entityId: id,
      before: { name: row.name },
    });
  }

  // ---------- expenses ----------

  async list(query: ListQuery) {
    const ctx = requireTenant();
    const finance = this.requireListAccess(ctx);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.db.expense.findMany({
      where: {
        ...(query.fy ? { financialYear: query.fy } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(finance ? (query.status ? { status: query.status } : {}) : { status: 'APPROVED' }),
        ...(cursor
          ? {
              OR: [
                { incurredOn: { lt: cursor.at } },
                { incurredOn: cursor.at, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: { category: true },
      orderBy: [{ incurredOn: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    return {
      items: items.map(toSummary),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ at: last.incurredOn, id: last.id })
          : null,
    };
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
    this.checkDate(ctx, body.incurredOn);
    const receiptIds = await this.files.claim(ctx, body.receiptIds ?? [], 'EXPENSE_RECEIPT');
    const status = this.needsApproval(ctx, body.amountPaise) ? 'PENDING' : 'APPROVED';
    let row: ExpenseWithCategory;
    try {
      row = await this.prisma.$transaction(async (tx) => {
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
    if (status === 'PENDING') await this.askApprovers(ctx, row);
    return this.toDto(ctx, row);
  }

  async update(expenseId: string, body: UpdateBody): Promise<Expense> {
    const ctx = requireTenant();
    const before = await this.requireEditable(ctx, expenseId);
    if (body.categoryId) await this.requireCategory(body.categoryId);
    const incurredOn = body.incurredOn ?? dateOnly(before.incurredOn);
    if (body.incurredOn) this.checkDate(ctx, body.incurredOn);
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
    const row = await this.prisma.$transaction(async (tx) => {
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
      return e;
    });
    if (receipts) await this.files.remove(receipts.dropped);
    if (status === 'PENDING') await this.askApprovers(ctx, row);
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
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id: expenseId, societyId: ctx.societyId },
        data: {
          status: approve ? 'APPROVED' : 'REJECTED',
          decidedByMembershipId: ctx.membershipId,
          decidedAt: new Date(),
          rejectionReason: approve ? null : (reason ?? null),
        },
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
      return updated;
    });
    const creator = await this.prisma.membership.findUnique({
      where: { id: e.createdByMembershipId },
      select: { userId: true },
    });
    if (creator)
      await this.notifications.notifyUsers({
        userIds: [creator.userId],
        societyId: ctx.societyId,
        category: 'EXPENSE',
        render: (t, locale) => ({
          title: t(approve ? 'expenses:push.approvedTitle' : 'expenses:push.rejectedTitle', {
            amount: formatMoney(e.amountPaise, locale),
          }),
          body: approve ? e.payeeName : `${e.payeeName} · ${reason ?? ''}`,
        }),
        data: { screen: 'expense', societyId: ctx.societyId, expenseId },
      });
    return this.toDto(ctx, row);
  }

  async remove(expenseId: string): Promise<void> {
    const ctx = requireTenant();
    const e = await this.requireEditable(ctx, expenseId);
    const receiptIds = await this.files.linked({ expenseId });
    await this.prisma.$transaction(async (tx) => {
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

  // ---------- income ----------

  async listIncome(fy: string | undefined): Promise<IncomeEntry[]> {
    const ctx = requireTenant();
    const year = fy ?? fyLabel(todayIn(ctx.society.timezone), ctx.society.fyStartMonth);
    const rows = await this.db.incomeEntry.findMany({
      where: { financialYear: year },
      orderBy: [{ receivedOn: 'desc' }, { createdAt: 'desc' }],
    });
    const names = await loadMemberNames(
      this.prisma,
      rows.map((r) => r.createdByMembershipId),
    );
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      amountPaise: r.amountPaise,
      receivedOn: dateOnly(r.receivedOn),
      description: r.description,
      createdBy: {
        membershipId: r.createdByMembershipId,
        displayName: names.get(r.createdByMembershipId)?.displayName ?? 'Committee',
      },
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async createIncome(body: IncomeBody): Promise<IncomeEntry> {
    const ctx = requireTenant();
    this.checkDate(ctx, body.receivedOn);
    const row = await this.db.incomeEntry.create({
      data: {
        societyId: ctx.societyId,
        kind: body.kind,
        amountPaise: body.amountPaise,
        receivedOn: dbDate(body.receivedOn),
        description: body.description || null,
        financialYear: fyLabel(body.receivedOn, ctx.society.fyStartMonth),
        createdByMembershipId: ctx.membershipId,
      },
    });
    await this.audit.record({
      action: 'income.created',
      entityType: 'IncomeEntry',
      entityId: row.id,
      after: { kind: row.kind, amountPaise: row.amountPaise },
    });
    const names = await loadMemberNames(this.prisma, [ctx.membershipId]);
    return {
      id: row.id,
      kind: row.kind,
      amountPaise: row.amountPaise,
      receivedOn: dateOnly(row.receivedOn),
      description: row.description,
      createdBy: {
        membershipId: ctx.membershipId,
        displayName: names.get(ctx.membershipId)?.displayName ?? 'Committee',
      },
      createdAt: row.createdAt.toISOString(),
    };
  }

  async deleteIncome(id: string): Promise<void> {
    const row = await this.db.incomeEntry.findUnique({ where: { id } });
    if (!row) throw ApiException.notFound('Income not found');
    await this.db.incomeEntry.delete({ where: { id } });
    await this.audit.record({
      action: 'income.deleted',
      entityType: 'IncomeEntry',
      entityId: id,
      before: { kind: row.kind, amountPaise: row.amountPaise },
    });
  }

  // ---------- helpers ----------

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

  private checkDate(ctx: TenantContext, date: string) {
    if (date > todayIn(ctx.society.timezone))
      throw ApiException.validation([
        { path: ['date'], message: 'Cannot be in the future', in: 'body' },
      ]);
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

  private async askApprovers(ctx: TenantContext, e: ExpenseWithCategory) {
    const approvers = await this.prisma.membership.findMany({
      where: {
        societyId: ctx.societyId,
        status: 'ACTIVE',
        id: { not: e.createdByMembershipId },
        roles: {
          some: { role: { permissions: { some: { permissionKey: 'expense.approve' } } } },
        },
      },
      select: { userId: true },
    });
    await this.notifications.notifyUsers({
      userIds: approvers.map((a) => a.userId),
      societyId: ctx.societyId,
      category: 'EXPENSE',
      render: (t, locale) => ({
        title: t('expenses:push.pendingTitle', { amount: formatMoney(e.amountPaise, locale) }),
        body: `${e.payeeName} · ${e.category.name}`,
      }),
      data: { screen: 'expense', societyId: ctx.societyId, expenseId: e.id },
    });
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

export function toCategory(c: CategoryRow): ExpenseCategory {
  const icon = VendorCategoryIconSchema.safeParse(c.icon);
  return {
    id: c.id,
    key: c.key,
    name: c.name,
    icon: icon.success ? icon.data : 'box',
    sortOrder: c.sortOrder,
  };
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
