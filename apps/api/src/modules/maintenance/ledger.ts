import type { BillSummary, PaymentInstruction, PaymentSummary } from '@movo/contracts';
import { lockFor } from '../../common/prisma/tx-lock';
import { dateOnly } from '../../common/util/dates';
import type { Prisma } from '../../generated/prisma/client';
import { toFlatRef } from '../tenancy/mappers';
import { allocate, billStatus } from './billing';

type Tx = Prisma.TransactionClient;

export const flatInclude = { flat: { include: { building: true } } } as const;

export const OPEN_STATUSES = ['DUE', 'PARTIALLY_PAID', 'OVERDUE'] as const;

type BillRow = Prisma.BillGetPayload<{ include: typeof flatInclude & { lines: true } }>;
type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof flatInclude }>;

export function toBillSummary(b: BillRow): BillSummary {
  const lateFee = b.lines.find((l) => l.type === 'LATE_FEE')?.amountPaise ?? 0;
  return {
    id: b.id,
    flat: toFlatRef(b.flat),
    kind: b.kind,
    title: b.title,
    periodKey: b.periodKey,
    dueDate: dateOnly(b.dueDate),
    totalPaise: b.totalPaise,
    paidPaise: b.paidPaise,
    outstandingPaise: outstanding(b),
    lateFeePaise: lateFee,
    status: b.status,
  };
}

export function toPaymentSummary(p: PaymentRow): PaymentSummary {
  return {
    id: p.id,
    flat: toFlatRef(p.flat),
    amountPaise: p.amountPaise,
    paidOn: dateOnly(p.paidOn),
    method: p.method,
    reference: p.reference,
    receiptNo: p.receiptNo,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  };
}

export function toInstruction(i: {
  id: string;
  kind: PaymentInstruction['kind'];
  label: string;
  value: string;
  payeeName: string | null;
  isActive: boolean;
}): PaymentInstruction {
  return {
    id: i.id,
    kind: i.kind,
    label: i.label,
    value: i.value,
    payeeName: i.payeeName,
    isActive: i.isActive,
  };
}

export function outstanding(b: { status: string; totalPaise: number; paidPaise: number }): number {
  return b.status === 'WAIVED' ? 0 : Math.max(0, b.totalPaise - b.paidPaise);
}

/** Recomputes total, paid and status from lines and live allocations. */
export async function refreshBills(tx: Tx, billIds: readonly string[], today: string) {
  for (const id of new Set(billIds)) {
    const bill = await tx.bill.findUniqueOrThrow({
      where: { id },
      include: {
        lines: true,
        allocations: { where: { payment: { status: 'RECORDED' } } },
      },
    });
    const totalPaise = bill.lines.reduce((s, l) => s + l.amountPaise, 0);
    const paidPaise = bill.allocations.reduce((s, a) => s + a.amountPaise, 0);
    const status = billStatus(
      {
        totalPaise,
        paidPaise,
        dueDate: dateOnly(bill.dueDate),
        waived: bill.status === 'WAIVED',
      },
      today,
    );
    if (totalPaise !== bill.totalPaise || paidPaise !== bill.paidPaise || status !== bill.status) {
      await tx.bill.update({ where: { id }, data: { totalPaise, paidPaise, status } });
    }
  }
}

/** Advance per payment: amount not yet allocated to any bill. Oldest payment first. */
async function unallocatedPayments(tx: Tx, societyId: string, flatId: string) {
  const payments = await tx.payment.findMany({
    where: { societyId, flatId, status: 'RECORDED' },
    include: { allocations: { select: { amountPaise: true } } },
    orderBy: [{ paidOn: 'asc' }, { createdAt: 'asc' }],
  });
  return payments
    .map((p) => ({
      id: p.id,
      leftPaise: p.amountPaise - p.allocations.reduce((s, a) => s + a.amountPaise, 0),
    }))
    .filter((p) => p.leftPaise > 0);
}

export async function creditOf(tx: Tx, societyId: string, flatId: string): Promise<number> {
  return (await unallocatedPayments(tx, societyId, flatId)).reduce((s, p) => s + p.leftPaise, 0);
}

/** Uses a flat's advance on its open bills, oldest bill first. Returns the bills touched. */
export async function applyCredit(
  tx: Tx,
  societyId: string,
  flatId: string,
  today: string,
): Promise<string[]> {
  await lockFor(tx, `flat-dues:${flatId}`);
  const payments = await unallocatedPayments(tx, societyId, flatId);
  if (payments.length === 0) return [];
  const bills = await tx.bill.findMany({
    where: { societyId, flatId, status: { in: [...OPEN_STATUSES] } },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
  });
  const open = bills.map((b) => ({ id: b.id, outstandingPaise: outstanding(b) }));
  const touched: string[] = [];
  for (const p of payments) {
    const { allocations } = allocate(p.leftPaise, open);
    for (const a of allocations) {
      await tx.paymentAllocation.create({
        data: { societyId, paymentId: p.id, billId: a.billId, amountPaise: a.amountPaise },
      });
      const bill = open.find((b) => b.id === a.billId);
      if (bill) bill.outstandingPaise -= a.amountPaise;
      touched.push(a.billId);
    }
  }
  await refreshBills(tx, touched, today);
  return touched;
}
