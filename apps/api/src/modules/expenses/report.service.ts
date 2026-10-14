import type { FinanceReport, IncomeKind } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can } from '../../common/tenant/tenant.types';
import { fyLabel, todayIn } from '../../common/util/dates';
import { OPEN_STATUSES } from '../maintenance/ledger';
import { expensesSettings, isFinanceRole, toCategory } from './expense-rules';

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-04" … "2027-03" for FY 2026-27 with an April start. */
export function fyMonths(fy: string, fyStartMonth: number): string[] {
  const startYear = Number(fy.slice(0, 4));
  return Array.from({ length: 12 }, (_, i) => {
    const m0 = fyStartMonth - 1 + i;
    return `${startYear + Math.floor(m0 / 12)}-${pad((m0 % 12) + 1)}`;
  });
}

@Injectable()
export class ReportService {
  constructor(private readonly tenant: TenantPrismaService) {}

  private get db() {
    return this.tenant.client;
  }

  async report(fyQuery: string | undefined): Promise<FinanceReport> {
    const ctx = requireTenant();
    if (!isFinanceRole(ctx) && expensesSettings(ctx).visibleToMembers === 'NONE')
      throw ApiException.forbidden('Your committee has not shared the accounts');
    const current = fyLabel(todayIn(ctx.society.timezone), ctx.society.fyStartMonth);
    const fy = fyQuery ?? current;
    const full = can(ctx, 'finance.reports.view');

    // Sums are done by Postgres, grouped by month (and kind or category); no rows come back.
    const sid = ctx.societyId;
    const [payments, income, expenses, pending, dues, years] = await Promise.all([
      this.db.$queryRaw<{ month: string; amount: bigint }[]>`
        SELECT to_char("paidOn", 'YYYY-MM') AS month, SUM("amountPaise")::bigint AS amount
        FROM "Payment"
        WHERE "societyId" = ${sid}::uuid AND "financialYear" = ${fy} AND "status" = 'RECORDED'
        GROUP BY 1`,
      this.db.$queryRaw<{ kind: IncomeKind; month: string; amount: bigint }[]>`
        SELECT "kind"::text AS kind, to_char("receivedOn", 'YYYY-MM') AS month,
               SUM("amountPaise")::bigint AS amount
        FROM "IncomeEntry"
        WHERE "societyId" = ${sid}::uuid AND "financialYear" = ${fy}
        GROUP BY 1, 2`,
      this.db.$queryRaw<{ categoryId: string; month: string; amount: bigint; n: bigint }[]>`
        SELECT "categoryId"::text AS "categoryId", to_char("incurredOn", 'YYYY-MM') AS month,
               SUM("amountPaise")::bigint AS amount, COUNT(*)::bigint AS n
        FROM "Expense"
        WHERE "societyId" = ${sid}::uuid AND "financialYear" = ${fy} AND "status" = 'APPROVED'
        GROUP BY 1, 2`,
      full
        ? this.db.expense.aggregate({
            where: { financialYear: fy, status: 'PENDING' },
            _count: { _all: true },
            _sum: { amountPaise: true },
          })
        : null,
      full
        ? this.db.$queryRaw<{ amount: bigint | null }[]>`
            SELECT SUM(GREATEST(0, "totalPaise" - "paidPaise"))::bigint AS amount
            FROM "Bill"
            WHERE "societyId" = ${sid}::uuid
              AND "status"::text = ANY(${[...OPEN_STATUSES]})`
        : null,
      this.years(sid),
    ]);

    const months = new Map(
      fyMonths(fy, ctx.society.fyStartMonth).map((m) => [m, { incomePaise: 0, expensePaise: 0 }]),
    );
    const bump = (month: string, key: 'incomePaise' | 'expensePaise', amount: number) => {
      const m = months.get(month);
      if (m) m[key] += amount;
    };

    let maintenancePaise = 0;
    for (const p of payments) {
      maintenancePaise += Number(p.amount);
      bump(p.month, 'incomePaise', Number(p.amount));
    }
    const byKind = new Map<IncomeKind, number>();
    for (const i of income) {
      byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + Number(i.amount));
      bump(i.month, 'incomePaise', Number(i.amount));
    }
    const otherPaise = [...byKind.values()].reduce((s, v) => s + v, 0);

    const categories = new Map(
      (
        await this.db.expenseCategory.findMany({
          where: { id: { in: [...new Set(expenses.map((e) => e.categoryId))] } },
        })
      ).map((c) => [c.id, c]),
    );
    const byCategory = new Map<
      string,
      { category: ReturnType<typeof toCategory>; amountPaise: number; count: number }
    >();
    let spent = 0;
    for (const e of expenses) {
      const row = categories.get(e.categoryId);
      if (!row) continue;
      const c = byCategory.get(e.categoryId) ?? {
        category: toCategory(row),
        amountPaise: 0,
        count: 0,
      };
      c.amountPaise += Number(e.amount);
      c.count += Number(e.n);
      byCategory.set(e.categoryId, c);
      spent += Number(e.amount);
      bump(e.month, 'expensePaise', Number(e.amount));
    }
    const incomeTotal = maintenancePaise + otherPaise;

    return {
      financialYear: fy,
      years: [...new Set([current, ...years])].sort().reverse(),
      income: {
        maintenancePaise,
        byKind: [...byKind.entries()]
          .map(([kind, amountPaise]) => ({ kind, amountPaise }))
          .sort((a, b) => b.amountPaise - a.amountPaise),
        totalPaise: incomeTotal,
      },
      expenses: {
        totalPaise: spent,
        byCategory: [...byCategory.values()].sort((a, b) => b.amountPaise - a.amountPaise),
      },
      netPaise: incomeTotal - spent,
      months: [...months.entries()].map(([month, v]) => ({ month, ...v })),
      pending: pending
        ? { count: pending._count._all, amountPaise: pending._sum.amountPaise ?? 0 }
        : null,
      outstandingDuesPaise: dues ? Number(dues[0]?.amount ?? 0) : null,
    };
  }

  /** Years with any money row, in one query. */
  private async years(societyId: string): Promise<string[]> {
    const rows = await this.db.$queryRaw<{ fy: string }[]>`
      SELECT "financialYear" AS fy FROM "Payment" WHERE "societyId" = ${societyId}::uuid
      UNION SELECT "financialYear" FROM "Expense" WHERE "societyId" = ${societyId}::uuid
      UNION SELECT "financialYear" FROM "IncomeEntry" WHERE "societyId" = ${societyId}::uuid`;
    return rows.map((r) => r.fy);
  }
}
