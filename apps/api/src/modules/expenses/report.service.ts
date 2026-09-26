import type { FinanceReport, IncomeKind } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can } from '../../common/tenant/tenant.types';
import { fyLabel, todayIn } from '../maintenance/billing';
import { dateOnly, OPEN_STATUSES, outstanding } from '../maintenance/ledger';
import { expensesSettings, isFinanceRole, toCategory } from './expenses.service';

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

    const [payments, income, expenses, pending, openBills, years] = await Promise.all([
      this.db.payment.findMany({
        where: { financialYear: fy, status: 'RECORDED' },
        select: { amountPaise: true, paidOn: true },
      }),
      this.db.incomeEntry.findMany({
        where: { financialYear: fy },
        select: { kind: true, amountPaise: true, receivedOn: true },
      }),
      this.db.expense.findMany({
        where: { financialYear: fy, status: 'APPROVED' },
        select: { amountPaise: true, incurredOn: true, category: true },
      }),
      full
        ? this.db.expense.aggregate({
            where: { financialYear: fy, status: 'PENDING' },
            _count: { _all: true },
            _sum: { amountPaise: true },
          })
        : null,
      full ? this.db.bill.findMany({ where: { status: { in: [...OPEN_STATUSES] } } }) : null,
      this.years(),
    ]);

    const months = new Map(
      fyMonths(fy, ctx.society.fyStartMonth).map((m) => [m, { incomePaise: 0, expensePaise: 0 }]),
    );
    const bump = (date: Date, key: 'incomePaise' | 'expensePaise', amount: number) => {
      const m = months.get(dateOnly(date).slice(0, 7));
      if (m) m[key] += amount;
    };

    const maintenancePaise = payments.reduce((s, p) => s + p.amountPaise, 0);
    for (const p of payments) bump(p.paidOn, 'incomePaise', p.amountPaise);
    const byKind = new Map<IncomeKind, number>();
    for (const i of income) {
      byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + i.amountPaise);
      bump(i.receivedOn, 'incomePaise', i.amountPaise);
    }
    const otherPaise = [...byKind.values()].reduce((s, v) => s + v, 0);

    const byCategory = new Map<
      string,
      { category: ReturnType<typeof toCategory>; amountPaise: number; count: number }
    >();
    for (const e of expenses) {
      const c = byCategory.get(e.category.id) ?? {
        category: toCategory(e.category),
        amountPaise: 0,
        count: 0,
      };
      c.amountPaise += e.amountPaise;
      c.count += 1;
      byCategory.set(e.category.id, c);
      bump(e.incurredOn, 'expensePaise', e.amountPaise);
    }
    const spent = expenses.reduce((s, e) => s + e.amountPaise, 0);
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
      outstandingDuesPaise: openBills ? openBills.reduce((s, b) => s + outstanding(b), 0) : null,
    };
  }

  private async years(): Promise<string[]> {
    const [p, e, i] = await Promise.all([
      this.db.payment.findMany({ distinct: ['financialYear'], select: { financialYear: true } }),
      this.db.expense.findMany({ distinct: ['financialYear'], select: { financialYear: true } }),
      this.db.incomeEntry.findMany({
        distinct: ['financialYear'],
        select: { financialYear: true },
      }),
    ]);
    return [...p, ...e, ...i].map((r) => r.financialYear);
  }
}
