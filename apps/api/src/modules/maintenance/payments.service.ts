import type { maintenanceContract, Payment, RouteBody, RouteQuery } from '@movo/contracts';
import { formatMoney } from '@movo/i18n';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { isUniqueViolation } from '../../common/errors/prisma-errors';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantPrismaService } from '../../common/prisma/tenant-prisma.service';
import { requireTenant } from '../../common/request-store';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import { minutes } from '../../common/util/dates';
import { decodeCursor, encodeCursor } from '../../common/util/pagination';
import type { Prisma } from '../../generated/prisma/client';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toFlatRef } from '../tenancy/mappers';
import { loadMemberNames } from '../tenancy/member-names';
import { allocate, fyLabel, receiptNo, todayIn } from './billing';
import { BillsService } from './bills.service';
import {
  dbDate,
  flatInclude,
  flatLabel,
  flatUserIds,
  OPEN_STATUSES,
  outstanding,
  refreshBills,
  toPaymentSummary,
} from './ledger';

type RecordBody = RouteBody<typeof maintenanceContract.recordPayment>;
type ListQuery = RouteQuery<typeof maintenanceContract.listPayments>;

/** The person who entered a payment may undo it this long without maintenance.waive. */
const TYPO_WINDOW_MS = minutes(10);

const paymentInclude = {
  ...flatInclude,
  allocations: { include: { bill: true } },
  proofs: { select: { id: true }, orderBy: { sortOrder: 'asc' } },
} as const;
type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly tenant: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly bills: BillsService,
    private readonly files: FilesService,
  ) {}

  private get db() {
    return this.tenant.client;
  }

  async list(query: ListQuery) {
    const ctx = requireTenant();
    const flatIds = this.bills.visibleFlatIds(ctx, query.flatId);
    const cursor = decodeCursor(query.cursor);
    const rows = await this.db.payment.findMany({
      where: {
        ...(flatIds ? { flatId: { in: flatIds } } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.at } },
                { createdAt: cursor.at, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      include: flatInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    return {
      items: items.map(toPaymentSummary),
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor({ at: last.createdAt, id: last.id })
          : null,
    };
  }

  async get(paymentId: string): Promise<Payment> {
    const ctx = requireTenant();
    const p = await this.db.payment.findUnique({
      where: { id: paymentId },
      include: paymentInclude,
    });
    if (!p || !this.bills.canSeeFlat(ctx, p.flatId))
      throw ApiException.notFound('Payment not found');
    return this.toDto(ctx, p);
  }

  async record(body: RecordBody): Promise<Payment> {
    const ctx = requireTenant();
    const repeat = await this.db.payment.findFirst({
      where: { idempotencyKey: body.idempotencyKey },
    });
    if (repeat) return this.get(repeat.id);

    const flat = await this.db.flat.findUnique({
      where: { id: body.flatId },
      include: { building: true },
    });
    if (!flat) throw ApiException.notFound('Flat not found');
    const today = todayIn(ctx.society.timezone);
    if (body.paidOn > today)
      throw ApiException.validation([
        { path: ['paidOn'], message: 'Cannot be in the future', in: 'body' },
      ]);
    const fy = fyLabel(body.paidOn, ctx.society.fyStartMonth);
    const proofIds = await this.files.claim(ctx, body.proofIds ?? [], 'PAYMENT_PROOF');

    let paymentId: string;
    try {
      paymentId = await this.prisma.$transaction(async (tx) => {
        const open = await tx.bill.findMany({
          where: {
            societyId: ctx.societyId,
            flatId: flat.id,
            status: { in: [...OPEN_STATUSES] },
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        });
        const allocations = body.allocations
          ? this.checkAllocations(body.allocations, body.amountPaise, open)
          : allocate(
              body.amountPaise,
              open.map((b) => ({ id: b.id, outstandingPaise: outstanding(b) })),
            ).allocations;

        const counter = await tx.receiptCounter.upsert({
          where: { societyId_financialYear: { societyId: ctx.societyId, financialYear: fy } },
          create: { societyId: ctx.societyId, financialYear: fy, lastNo: 1 },
          update: { lastNo: { increment: 1 } },
        });
        const p = await tx.payment.create({
          data: {
            societyId: ctx.societyId,
            flatId: flat.id,
            amountPaise: body.amountPaise,
            paidOn: dbDate(body.paidOn),
            method: body.method,
            reference: body.reference || null,
            notes: body.notes || null,
            receiptNo: receiptNo(fy, counter.lastNo),
            financialYear: fy,
            recordedByMembershipId: ctx.membershipId,
            idempotencyKey: body.idempotencyKey,
            allocations: {
              create: allocations.map((a) => ({
                societyId: ctx.societyId,
                billId: a.billId,
                amountPaise: a.amountPaise,
              })),
            },
          },
        });
        await this.files.link(tx, proofIds, { paymentId: p.id });
        await refreshBills(
          tx,
          allocations.map((a) => a.billId),
          today,
        );
        await this.audit.record(
          {
            action: 'payment.recorded',
            entityType: 'Payment',
            entityId: p.id,
            after: {
              flatId: flat.id,
              amountPaise: p.amountPaise,
              receiptNo: p.receiptNo,
              method: p.method,
            },
          },
          tx,
        );
        return p.id;
      });
    } catch (error) {
      // A retry that raced the first request: hand back the payment that won.
      if (!isUniqueViolation(error)) throw error;
      const winner = await this.db.payment.findFirst({
        where: { idempotencyKey: body.idempotencyKey },
      });
      if (!winner) throw error;
      return this.get(winner.id);
    }

    const dto = await this.get(paymentId);
    const users = (await flatUserIds(this.prisma, [flat.id])).get(flat.id) ?? [];
    await this.notifications.notifyUsers({
      userIds: users.filter((u) => u !== ctx.userId),
      societyId: ctx.societyId,
      category: 'MAINTENANCE',
      render: (t, locale) => ({
        title: t('money:push.paymentTitle', { amount: formatMoney(dto.amountPaise, locale) }),
        body: t('money:push.paymentBody', {
          receipt: dto.receiptNo,
          flat: flatLabel(toFlatRef(flat)),
        }),
      }),
      data: { screen: 'payment', societyId: ctx.societyId, paymentId },
    });
    return dto;
  }

  async reverse(paymentId: string, reason: string): Promise<Payment> {
    const ctx = requireTenant();
    const p = await this.db.payment.findUnique({
      where: { id: paymentId },
      include: paymentInclude,
    });
    if (!p) throw ApiException.notFound('Payment not found');
    if (p.status === 'REVERSED')
      throw ApiException.conflict('CONFLICT', 'This payment is already reversed');
    if (!this.canReverse(ctx, p))
      throw ApiException.forbidden('Ask someone who can waive dues to reverse this payment');
    const today = todayIn(ctx.society.timezone);
    await this.prisma.$transaction(async (tx) => {
      const billIds = p.allocations.map((a) => a.billId);
      await tx.paymentAllocation.deleteMany({ where: { paymentId } });
      await tx.payment.update({
        where: { id: paymentId, societyId: ctx.societyId },
        data: { status: 'REVERSED', reversedReason: reason, reversedAt: new Date() },
      });
      await refreshBills(tx, billIds, today);
      await this.audit.record(
        {
          action: 'payment.reversed',
          entityType: 'Payment',
          entityId: paymentId,
          before: {
            amountPaise: p.amountPaise,
            allocations: p.allocations.map((a) => ({
              billId: a.billId,
              amountPaise: a.amountPaise,
            })),
          },
          after: { reason },
        },
        tx,
      );
    });
    const users = (await flatUserIds(this.prisma, [p.flatId])).get(p.flatId) ?? [];
    await this.notifications.notifyUsers({
      userIds: users.filter((u) => u !== ctx.userId),
      societyId: ctx.societyId,
      category: 'MAINTENANCE',
      render: (t, locale) => ({
        title: t('money:push.reversedTitle', { amount: formatMoney(p.amountPaise, locale) }),
        body: t('money:push.reversedBody', { receipt: p.receiptNo, reason }),
      }),
      data: { screen: 'payment', societyId: ctx.societyId, paymentId },
    });
    return this.get(paymentId);
  }

  private canReverse(
    ctx: TenantContext,
    p: { status: string; recordedByMembershipId: string; createdAt: Date },
  ) {
    if (p.status !== 'RECORDED' || !can(ctx, 'maintenance.record_payment')) return false;
    if (can(ctx, 'maintenance.waive')) return true;
    return (
      p.recordedByMembershipId === ctx.membershipId &&
      Date.now() - p.createdAt.getTime() <= TYPO_WINDOW_MS
    );
  }

  private checkAllocations(
    requested: { billId: string; amountPaise: number }[],
    amountPaise: number,
    open: { id: string; status: string; totalPaise: number; paidPaise: number }[],
  ) {
    const byId = new Map(open.map((b) => [b.id, b]));
    let sum = 0;
    for (const a of requested) {
      const bill = byId.get(a.billId);
      if (!bill)
        throw ApiException.validation([
          { path: ['allocations'], message: 'Bill is not open for this flat', in: 'body' },
        ]);
      if (a.amountPaise > outstanding(bill))
        throw ApiException.validation([
          { path: ['allocations'], message: 'More than the bill needs', in: 'body' },
        ]);
      sum += a.amountPaise;
    }
    if (sum > amountPaise)
      throw ApiException.validation([
        { path: ['allocations'], message: 'Adds up to more than the payment', in: 'body' },
      ]);
    return requested;
  }

  private async toDto(ctx: TenantContext, p: PaymentRow): Promise<Payment> {
    const names = await loadMemberNames(this.prisma, [p.recordedByMembershipId]);
    const allocated = p.allocations.reduce((s, a) => s + a.amountPaise, 0);
    return {
      ...toPaymentSummary(p),
      notes: p.notes,
      recordedBy: {
        membershipId: p.recordedByMembershipId,
        displayName: names.get(p.recordedByMembershipId)?.displayName ?? 'Committee',
      },
      allocations: p.allocations.map((a) => ({
        billId: a.billId,
        title: a.bill.title,
        periodKey: a.bill.periodKey,
        amountPaise: a.amountPaise,
      })),
      unallocatedPaise: p.status === 'RECORDED' ? p.amountPaise - allocated : 0,
      reversedReason: p.reversedReason,
      canReverse: this.canReverse(ctx, p),
      proofs: p.proofs.map((f) => this.files.ref(f.id)),
    };
  }
}
