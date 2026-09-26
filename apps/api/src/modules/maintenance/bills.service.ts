import {
  type Bill,
  type FlatRef,
  LateFeeRuleSchema,
  type maintenanceContract,
  type RouteBody,
  type RouteQuery,
} from '@movo/contracts';
import { formatDate, formatMoney, formatPeriod } from '@movo/i18n';
import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import { decodeCursor, encodeCursor } from '../../common/util/pagination';
import type { Prisma } from '../../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { toFlatRef } from '../tenancy/mappers';
import {
  amountFor,
  fyLabel,
  lateFeeFor,
  openedDuesReminders,
  periodsToGenerate,
  todayIn,
} from './billing';
import {
  applyCredit,
  dateOnly,
  dbDate,
  flatInclude,
  flatLabel,
  flatUserIds,
  OPEN_STATUSES,
  outstanding,
  refreshBills,
  toBillSummary,
} from './ledger';

type AdhocBody = RouteBody<typeof maintenanceContract.createAdhocBills>;
type ListQuery = RouteQuery<typeof maintenanceContract.listBills>;

const billInclude = { ...flatInclude, lines: true } as const;
type BillRow = Prisma.BillGetPayload<{ include: typeof billInclude }>;

interface NewBill {
  id: string;
  flatId: string;
  title: string;
  periodKey: string | null;
  dueDate: string;
  totalPaise: number;
}

@Injectable()
export class BillsService {
  private readonly logger = new Logger(BillsService.name);

  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async list(query: ListQuery) {
    const ctx = requireTenant();
    const flatIds = this.visibleFlatIds(ctx, query.flatId);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.db.bill.findMany({
      where: {
        ...(flatIds ? { flatId: { in: flatIds } } : {}),
        ...(query.open === 'true' ? { status: { in: [...OPEN_STATUSES] } } : {}),
        ...(cursor
          ? {
              OR: [{ dueDate: { lt: cursor.at } }, { dueDate: cursor.at, id: { lt: cursor.id } }],
            }
          : {}),
      },
      include: billInclude,
      orderBy: [{ dueDate: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    return {
      items: items.map(toBillSummary),
      nextCursor:
        rows.length > query.limit && last ? encodeCursor({ at: last.dueDate, id: last.id }) : null,
    };
  }

  async get(billId: string): Promise<Bill> {
    const ctx = requireTenant();
    const b = await this.db.bill.findUnique({ where: { id: billId }, include: billInclude });
    if (!b || !this.canSeeFlat(ctx, b.flatId)) throw ApiException.notFound('Bill not found');
    return this.toDto(b);
  }

  /** Request entry point: runs generation for the caller's society now. */
  async generateNow() {
    const ctx = requireTenant();
    const result = await this.generateForSociety(ctx.societyId, new Date());
    await this.audit.record({
      action: 'bills.generated',
      entityType: 'Bill',
      after: { created: result.created },
    });
    return result;
  }

  /**
   * Creates the bills every active plan needs by today, uses any advance, notifies the flats.
   * Existing (plan, flat, period) bills are left alone, so it is safe to run again.
   */
  async generateForSociety(
    societyId: string,
    now: Date,
  ): Promise<{ created: number; skippedFlats: FlatRef[] }> {
    const society = await this.prisma.society.findUniqueOrThrow({ where: { id: societyId } });
    const mod = await this.prisma.societyModule.findUnique({
      where: { societyId_moduleKey: { societyId, moduleKey: 'maintenance' } },
    });
    if (mod && !mod.enabled) return { created: 0, skippedFlats: [] };
    const today = todayIn(society.timezone, now);
    const plans = await this.prisma.billingPlan.findMany({
      where: { societyId, isActive: true },
      include: { overrides: true },
    });
    if (plans.length === 0) return { created: 0, skippedFlats: [] };
    const flats = await this.prisma.flat.findMany({
      where: { societyId, status: { not: 'INACTIVE' } },
      include: { building: true },
    });

    const skipped = new Map<string, FlatRef>();
    const created: NewBill[] = [];
    await this.prisma.$transaction(
      async (tx) => {
        for (const plan of plans) {
          const periods = periodsToGenerate(
            {
              frequency: plan.frequency,
              dueDay: plan.dueDay,
              generateDaysBefore: plan.generateDaysBefore,
              activeFrom: dateOnly(plan.activeFrom),
              activeTo: plan.activeTo ? dateOnly(plan.activeTo) : null,
            },
            today,
            society.fyStartMonth,
          );
          if (periods.length === 0) continue;
          const overrides = new Map(plan.overrides.map((o) => [o.flatId, o.amountPaise]));
          for (const period of periods) {
            const existing = new Set(
              (
                await tx.bill.findMany({
                  where: { planId: plan.id, periodKey: period.key },
                  select: { flatId: true },
                })
              ).map((b) => b.flatId),
            );
            for (const flat of flats) {
              if (existing.has(flat.id)) continue;
              const amount = amountFor(
                plan.amountRule,
                plan.amountPaise,
                flat,
                overrides.get(flat.id),
              );
              if (amount === null) {
                skipped.set(flat.id, toFlatRef(flat));
                continue;
              }
              if (amount === 0) continue;
              const bill = await tx.bill.create({
                data: {
                  societyId,
                  flatId: flat.id,
                  planId: plan.id,
                  kind: 'MAINTENANCE',
                  title: plan.name,
                  periodKey: period.key,
                  dueDate: dbDate(period.dueDate),
                  financialYear: fyLabel(period.dueDate, society.fyStartMonth),
                  totalPaise: amount,
                  lines: {
                    create: { societyId, type: 'BASE', label: plan.name, amountPaise: amount },
                  },
                },
              });
              created.push({
                id: bill.id,
                flatId: flat.id,
                title: plan.name,
                periodKey: period.key,
                dueDate: period.dueDate,
                totalPaise: amount,
              });
            }
          }
        }
        await this.afterCreate(tx, societyId, created, today);
      },
      { timeout: 60_000 },
    );
    await this.notifyNewBills(societyId, created);
    return { created: created.length, skippedFlats: [...skipped.values()] };
  }

  async createAdhoc(body: AdhocBody): Promise<{ created: number }> {
    const ctx = requireTenant();
    const today = todayIn(ctx.society.timezone);
    const flats = await this.db.flat.findMany({
      where: body.flatIds ? { id: { in: body.flatIds } } : { status: { not: 'INACTIVE' } },
    });
    if (body.flatIds && flats.length !== new Set(body.flatIds).size)
      throw ApiException.notFound('Flat not found');
    const created: NewBill[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const flat of flats) {
        const bill = await tx.bill.create({
          data: {
            societyId: ctx.societyId,
            flatId: flat.id,
            kind: 'ADHOC',
            title: body.title,
            dueDate: dbDate(body.dueDate),
            financialYear: fyLabel(body.dueDate, ctx.society.fyStartMonth),
            totalPaise: body.amountPaise,
            lines: {
              create: {
                societyId: ctx.societyId,
                type: 'BASE',
                label: body.title,
                amountPaise: body.amountPaise,
              },
            },
          },
        });
        created.push({
          id: bill.id,
          flatId: flat.id,
          title: body.title,
          periodKey: null,
          dueDate: body.dueDate,
          totalPaise: body.amountPaise,
        });
      }
      await this.afterCreate(tx, ctx.societyId, created, today);
      await this.audit.record(
        {
          action: 'bills.adhoc_created',
          entityType: 'Bill',
          after: { title: body.title, amountPaise: body.amountPaise, flats: flats.length },
        },
        tx,
      );
    });
    await this.notifyNewBills(ctx.societyId, created);
    return { created: created.length };
  }

  async waive(billId: string, reason: string): Promise<Bill> {
    const ctx = requireTenant();
    const b = await this.requireOpen(billId);
    await this.prisma.$transaction(async (tx) => {
      await tx.bill.update({
        where: { id: billId, societyId: ctx.societyId },
        data: { status: 'WAIVED', waivedReason: reason, waivedAt: new Date() },
      });
      await this.audit.record(
        {
          action: 'bill.waived',
          entityType: 'Bill',
          entityId: billId,
          before: { outstandingPaise: outstanding(b) },
          after: { reason },
        },
        tx,
      );
    });
    const users = (await flatUserIds(this.prisma, [b.flatId])).get(b.flatId) ?? [];
    await this.notifications.notifyUsers({
      userIds: users.filter((u) => u !== ctx.userId),
      societyId: ctx.societyId,
      category: 'MAINTENANCE',
      render: (t, locale) => ({
        title: t('money:push.waivedTitle', { name: billName(b.title, b.periodKey, locale) }),
        body: t('money:push.waivedBody', { flat: flatLabel(toFlatRef(b.flat)), reason }),
      }),
      data: { screen: 'bill', societyId: ctx.societyId, billId },
    });
    return this.get(billId);
  }

  async waiveLateFee(billId: string, reason: string): Promise<Bill> {
    const ctx = requireTenant();
    const b = await this.requireOpen(billId);
    const fee = b.lines.find((l) => l.type === 'LATE_FEE');
    await this.prisma.$transaction(async (tx) => {
      await tx.billLine.deleteMany({ where: { billId, type: 'LATE_FEE' } });
      await tx.bill.update({
        where: { id: billId, societyId: ctx.societyId },
        data: { lateFeeWaived: true },
      });
      await refreshBills(tx, [billId], todayIn(ctx.society.timezone));
      await this.audit.record(
        {
          action: 'bill.late_fee_waived',
          entityType: 'Bill',
          entityId: billId,
          before: { lateFeePaise: fee?.amountPaise ?? 0 },
          after: { reason },
        },
        tx,
      );
    });
    return this.get(billId);
  }

  /** Daily job: late fees and OVERDUE status for every society. */
  async applyLateFees(now: Date): Promise<number> {
    const societies = await this.prisma.society.findMany({ where: { status: 'ACTIVE' } });
    let changed = 0;
    for (const s of societies) {
      const today = todayIn(s.timezone, now);
      const bills = await this.prisma.bill.findMany({
        where: {
          societyId: s.id,
          status: { in: [...OPEN_STATUSES] },
          dueDate: { lt: dbDate(today) },
        },
        include: { lines: true, plan: true },
      });
      if (bills.length === 0) continue;
      await this.prisma.$transaction(async (tx) => {
        for (const b of bills) {
          if (b.plan && !b.lateFeeWaived) {
            const rule = LateFeeRuleSchema.parse(b.plan.lateFee);
            const base = b.lines.find((l) => l.type === 'BASE')?.amountPaise ?? 0;
            const fee = lateFeeFor(rule, base, dateOnly(b.dueDate), today);
            const line = b.lines.find((l) => l.type === 'LATE_FEE');
            if (fee > 0 && line?.amountPaise !== fee) {
              await tx.billLine.upsert({
                where: { billId_type: { billId: b.id, type: 'LATE_FEE' } },
                update: { amountPaise: fee },
                create: {
                  societyId: s.id,
                  billId: b.id,
                  type: 'LATE_FEE',
                  label: 'Late fee',
                  amountPaise: fee,
                },
              });
              changed += 1;
            }
          }
        }
        await refreshBills(
          tx,
          bills.map((b) => b.id),
          today,
        );
      });
    }
    if (changed > 0) this.logger.log(`late fees changed on ${changed} bill(s)`);
    return changed;
  }

  /** Daily job: 3 days before, on the due date, then weekly while overdue (4 times at most). */
  async sendDuesReminders(now: Date): Promise<number> {
    const societies = await this.prisma.society.findMany({
      where: { status: 'ACTIVE' },
      include: { modules: { where: { moduleKey: 'maintenance' } } },
    });
    let sent = 0;
    for (const s of societies) {
      if (s.modules[0] && !s.modules[0].enabled) continue;
      const today = todayIn(s.timezone, now);
      const bills = await this.prisma.bill.findMany({
        where: { societyId: s.id, status: { in: [...OPEN_STATUSES] } },
        include: flatInclude,
      });
      const users = await flatUserIds(
        this.prisma,
        bills.map((b) => b.flatId),
      );
      for (const b of bills) {
        const due = dateOnly(b.dueDate);
        const kinds = openedDuesReminders(due, today);
        const latest = kinds[kinds.length - 1];
        if (!latest) continue;
        const already = await this.prisma.reminderSent.findUnique({
          where: {
            entityType_entityId_kind: { entityType: 'Bill', entityId: b.id, kind: latest },
          },
        });
        if (already) continue;
        await this.prisma.reminderSent.createMany({
          data: kinds.map((kind) => ({
            societyId: s.id,
            entityType: 'Bill',
            entityId: b.id,
            kind,
          })),
          skipDuplicates: true,
        });
        const amount = outstanding(b);
        await this.notifications.notifyUsers({
          userIds: users.get(b.flatId) ?? [],
          societyId: s.id,
          category: 'MAINTENANCE',
          render: (t, locale) => ({
            title:
              latest === 'before-3d'
                ? t('money:push.reminderBefore', {
                    amount: formatMoney(amount, locale),
                    date: formatDate(b.dueDate, locale, 'short', 'UTC'),
                  })
                : latest === 'due-day'
                  ? t('money:push.reminderDue', { amount: formatMoney(amount, locale) })
                  : t('money:push.reminderOverdue', { amount: formatMoney(amount, locale) }),
            body: `${billName(b.title, b.periodKey, locale)} · ${flatLabel(toFlatRef(b.flat))}`,
          }),
          data: { screen: 'bill', societyId: s.id, billId: b.id },
        });
        sent += 1;
      }
    }
    if (sent > 0) this.logger.log(`sent ${sent} dues reminder(s)`);
    return sent;
  }

  /** Uses advance on the new bills and marks reminders the "new bill" push already covers. */
  private async afterCreate(
    tx: Prisma.TransactionClient,
    societyId: string,
    created: NewBill[],
    today: string,
  ) {
    for (const flatId of new Set(created.map((b) => b.flatId)))
      await applyCredit(tx, societyId, flatId, today);
    await refreshBills(
      tx,
      created.map((b) => b.id),
      today,
    );
    const opened = created.flatMap((b) =>
      openedDuesReminders(b.dueDate, today).map((kind) => ({
        societyId,
        entityType: 'Bill',
        entityId: b.id,
        kind,
      })),
    );
    if (opened.length > 0) await tx.reminderSent.createMany({ data: opened, skipDuplicates: true });
  }

  private async notifyNewBills(societyId: string, created: NewBill[]) {
    if (created.length === 0) return;
    const bills = await this.prisma.bill.findMany({
      where: { id: { in: created.map((b) => b.id) } },
      include: flatInclude,
    });
    const users = await flatUserIds(
      this.prisma,
      bills.map((b) => b.flatId),
    );
    for (const b of bills) {
      // Fully covered by advance: nothing to ask for.
      if (b.status === 'PAID') continue;
      await this.notifications.notifyUsers({
        userIds: users.get(b.flatId) ?? [],
        societyId,
        category: 'MAINTENANCE',
        render: (t, locale) => ({
          title: t('money:push.billTitle', { amount: formatMoney(outstanding(b), locale) }),
          body: t('money:push.billBody', {
            name: billName(b.title, b.periodKey, locale),
            flat: flatLabel(toFlatRef(b.flat)),
            date: formatDate(b.dueDate, locale, 'short', 'UTC'),
          }),
        }),
        data: { screen: 'bill', societyId, billId: b.id },
      });
    }
  }

  private async requireOpen(billId: string): Promise<BillRow> {
    const b = await this.db.bill.findUnique({ where: { id: billId }, include: billInclude });
    if (!b) throw ApiException.notFound('Bill not found');
    if (b.status === 'PAID' || b.status === 'WAIVED')
      throw ApiException.conflict('CONFLICT', 'This bill is already settled');
    return b;
  }

  canSeeFlat(ctx: TenantContext, flatId: string): boolean {
    return can(ctx, 'maintenance.view_all') || ctx.flatIds.includes(flatId);
  }

  /** undefined = every flat (view_all without a filter). */
  visibleFlatIds(ctx: TenantContext, flatId: string | undefined): string[] | undefined {
    if (flatId) {
      if (!this.canSeeFlat(ctx, flatId)) throw ApiException.notFound('Flat not found');
      return [flatId];
    }
    return can(ctx, 'maintenance.view_all') ? undefined : ctx.flatIds;
  }

  private async toDto(b: BillRow): Promise<Bill> {
    const allocations = await this.db.paymentAllocation.findMany({
      where: { billId: b.id, payment: { status: 'RECORDED' } },
      include: { payment: true },
      orderBy: { createdAt: 'asc' },
    });
    return {
      ...toBillSummary(b),
      lines: b.lines
        .sort((x, y) => (x.type === 'BASE' ? -1 : y.type === 'BASE' ? 1 : 0))
        .map((l) => ({ type: l.type, label: l.label, amountPaise: l.amountPaise })),
      payments: allocations.map((a) => ({
        paymentId: a.paymentId,
        receiptNo: a.payment.receiptNo,
        paidOn: dateOnly(a.payment.paidOn),
        method: a.payment.method,
        amountPaise: a.amountPaise,
      })),
      lateFeeWaived: b.lateFeeWaived,
      waivedReason: b.waivedReason,
      createdAt: b.createdAt.toISOString(),
    };
  }
}

export function billName(
  title: string,
  periodKey: string | null,
  locale: Parameters<typeof formatPeriod>[1],
): string {
  return periodKey ? `${title} · ${formatPeriod(periodKey, locale)}` : title;
}
