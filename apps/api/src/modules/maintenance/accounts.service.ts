import {
  type AttentionItem,
  type Collection,
  type CollectionStatus,
  type FlatAccount,
  parseModuleSettings,
} from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import { toFlatRef } from '../tenancy/mappers';
import { fyLabel, todayIn } from './billing';
import { BillsService } from './bills.service';
import {
  dateOnly,
  flatInclude,
  OPEN_STATUSES,
  outstanding,
  toBillSummary,
  toPaymentSummary,
} from './ledger';

@Injectable()
export class AccountsService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly bills: BillsService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async myDues(): Promise<{ flats: FlatAccount[] }> {
    const ctx = requireTenant();
    return { flats: await this.accounts(ctx.flatIds) };
  }

  async flatAccount(flatId: string): Promise<FlatAccount> {
    const ctx = requireTenant();
    if (!this.bills.canSeeFlat(ctx, flatId)) throw ApiException.notFound('Flat not found');
    const [account] = await this.accounts([flatId]);
    if (!account) throw ApiException.notFound('Flat not found');
    return account;
  }

  private async accounts(flatIds: string[]): Promise<FlatAccount[]> {
    if (flatIds.length === 0) return [];
    const [flats, open, payments] = await Promise.all([
      this.db.flat.findMany({ where: { id: { in: flatIds } }, include: { building: true } }),
      this.db.bill.findMany({
        where: { flatId: { in: flatIds }, status: { in: [...OPEN_STATUSES] } },
        include: { ...flatInclude, lines: true },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      }),
      this.db.payment.findMany({
        where: { flatId: { in: flatIds } },
        include: { ...flatInclude, allocations: { select: { amountPaise: true } } },
        orderBy: [{ paidOn: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);
    const order = new Map(flatIds.map((id, i) => [id, i]));
    return flats
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((flat) => {
        const bills = open.filter((b) => b.flatId === flat.id);
        const mine = payments.filter((p) => p.flatId === flat.id);
        const credit = mine
          .filter((p) => p.status === 'RECORDED')
          .reduce(
            (s, p) => s + p.amountPaise - p.allocations.reduce((x, a) => x + a.amountPaise, 0),
            0,
          );
        return {
          flat: toFlatRef(flat),
          outstandingPaise: bills.reduce((s, b) => s + outstanding(b), 0),
          creditPaise: credit,
          overdue: bills.some((b) => b.status === 'OVERDUE'),
          nextDueDate: bills[0] ? dateOnly(bills[0].dueDate) : null,
          openBills: bills.map(toBillSummary),
          recentPayments: mine.slice(0, 6).map(toPaymentSummary),
        };
      });
  }

  async collection(): Promise<Collection> {
    const ctx = requireTenant();
    const transparency = parseModuleSettings(
      'maintenance',
      ctx.moduleSettings.maintenance,
    ).transparency;
    const viewAll = can(ctx, 'maintenance.view_all');
    if (!viewAll && transparency === 'OFF') throw ApiException.forbidden();
    const showAmounts = viewAll || transparency === 'STATUS_AND_AMOUNT';
    const fy = fyLabel(todayIn(ctx.society.timezone), ctx.society.fyStartMonth);

    const [flats, bills, lastPayments, fyBills, fyPaid] = await Promise.all([
      this.db.flat.findMany({
        where: { status: { not: 'INACTIVE' } },
        include: { building: true },
      }),
      this.db.bill.groupBy({
        by: ['flatId', 'status'],
        _count: { _all: true },
        _sum: { totalPaise: true, paidPaise: true },
      }),
      this.db.payment.groupBy({
        by: ['flatId'],
        where: { status: 'RECORDED' },
        _max: { paidOn: true },
      }),
      this.db.bill.aggregate({
        where: { financialYear: fy, status: { not: 'WAIVED' } },
        _sum: { totalPaise: true },
      }),
      this.db.payment.aggregate({
        where: { financialYear: fy, status: 'RECORDED' },
        _sum: { amountPaise: true },
      }),
    ]);

    const byFlat = new Map<string, { statuses: Set<string>; outstanding: number }>();
    for (const g of bills) {
      const e = byFlat.get(g.flatId) ?? { statuses: new Set<string>(), outstanding: 0 };
      e.statuses.add(g.status);
      if ((OPEN_STATUSES as readonly string[]).includes(g.status))
        e.outstanding += (g._sum.totalPaise ?? 0) - (g._sum.paidPaise ?? 0);
      byFlat.set(g.flatId, e);
    }
    const lastPaid = new Map(lastPayments.map((p) => [p.flatId, p._max.paidOn]));
    const rows = flats
      .map((f) => {
        const e = byFlat.get(f.id);
        const status: CollectionStatus = !e
          ? 'NO_BILLS'
          : e.statuses.has('OVERDUE')
            ? 'OVERDUE'
            : e.statuses.has('DUE') || e.statuses.has('PARTIALLY_PAID')
              ? 'DUE'
              : 'PAID';
        const paidOn = lastPaid.get(f.id);
        return {
          flat: toFlatRef(f),
          status,
          outstandingPaise: showAmounts ? (e?.outstanding ?? 0) : null,
          lastPaidOn: paidOn ? dateOnly(paidOn) : null,
        };
      })
      .sort(
        (a, b) =>
          (a.flat.buildingName ?? '').localeCompare(b.flat.buildingName ?? '') ||
          a.flat.number.localeCompare(b.flat.number, undefined, { numeric: true }),
      );
    const count = (s: CollectionStatus) => rows.filter((r) => r.status === s).length;
    const billed = fyBills._sum.totalPaise ?? 0;
    const collected = fyPaid._sum.amountPaise ?? 0;
    return {
      financialYear: fy,
      showAmounts,
      counts: {
        flats: rows.length,
        paid: count('PAID'),
        due: count('DUE'),
        overdue: count('OVERDUE'),
      },
      billedPaise: showAmounts ? billed : null,
      collectedPaise: showAmounts ? collected : null,
      outstandingPaise: showAmounts
        ? rows.reduce((s, r) => s + (r.outstandingPaise ?? 0), 0)
        : null,
      rows,
    };
  }

  /** One DUES item per flat of mine that owes money. */
  async attentionForHome(ctx: TenantContext): Promise<AttentionItem[]> {
    if (ctx.flatIds.length === 0) return [];
    const accounts = await this.accounts(ctx.flatIds);
    return accounts
      .filter((a) => a.outstandingPaise > 0 && a.nextDueDate)
      .map((a) => ({
        type: 'DUES' as const,
        flat: a.flat,
        amountPaise: a.outstandingPaise,
        dueDate: a.nextDueDate ?? '',
        overdue: a.overdue,
      }));
  }
}
