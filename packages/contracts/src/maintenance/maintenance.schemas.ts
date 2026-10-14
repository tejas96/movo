import { z } from 'zod';
import {
  ActorSchema,
  FlatRefSchema,
  IdSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  PaiseSchema,
} from '../core/common';
import { FileRefSchema } from '../files/files.contract';

export const BillingFrequencySchema = z.enum(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY']);
export type BillingFrequency = z.infer<typeof BillingFrequencySchema>;

/** FLAT_RATE: amountPaise per flat per bill. PER_SQFT: amountPaise per square foot per bill. */
export const AmountRuleSchema = z.enum(['FLAT_RATE', 'PER_SQFT']);
export type AmountRule = z.infer<typeof AmountRuleSchema>;

export const LateFeeRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('NONE') }).strict(),
  z
    .object({
      type: z.literal('FIXED'),
      amountPaise: PaiseSchema.min(1),
      graceDays: z.number().int().min(0).max(60),
    })
    .strict(),
  z
    .object({
      type: z.literal('PERCENT'),
      /** 1% = 100 basis points, of the bill's base amount. */
      basisPoints: z.number().int().min(1).max(10_000),
      graceDays: z.number().int().min(0).max(60),
      capPaise: PaiseSchema.nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal('PER_DAY'),
      amountPaise: PaiseSchema.min(1),
      graceDays: z.number().int().min(0).max(60),
      capPaise: PaiseSchema.nullable(),
    })
    .strict(),
]);
export type LateFeeRule = z.infer<typeof LateFeeRuleSchema>;

export const BillStatusSchema = z.enum(['DUE', 'PARTIALLY_PAID', 'OVERDUE', 'PAID', 'WAIVED']);
export type BillStatus = z.infer<typeof BillStatusSchema>;
export const BillKindSchema = z.enum(['MAINTENANCE', 'ADHOC']);
export const BillLineTypeSchema = z.enum(['BASE', 'LATE_FEE']);
export const PaymentMethodSchema = z.enum(['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export const PaymentStatusSchema = z.enum(['RECORDED', 'REVERSED']);
export const PaymentInstructionKindSchema = z.enum(['UPI', 'BANK', 'OTHER']);

export const BillingPlanSchema = z.object({
  id: IdSchema,
  name: z.string(),
  frequency: BillingFrequencySchema,
  amountRule: AmountRuleSchema,
  amountPaise: PaiseSchema,
  /** Day of the first month of each period. 1 to 28. */
  dueDay: z.number().int(),
  generateDaysBefore: z.number().int(),
  lateFee: LateFeeRuleSchema,
  activeFrom: IsoDateSchema,
  activeTo: IsoDateSchema.nullable(),
  isActive: z.boolean(),
  overrides: z.array(z.object({ flat: FlatRefSchema, amountPaise: PaiseSchema })),
  createdAt: IsoDateTimeSchema,
});
export type BillingPlan = z.infer<typeof BillingPlanSchema>;

export const BillSummarySchema = z.object({
  id: IdSchema,
  flat: FlatRefSchema,
  kind: BillKindSchema,
  title: z.string(),
  /** 2026-10 (monthly), 2026-27-Q1, 2026-27-H1, 2026-27 (yearly). Null for one-off bills. */
  periodKey: z.string().nullable(),
  dueDate: IsoDateSchema,
  totalPaise: PaiseSchema,
  paidPaise: PaiseSchema,
  outstandingPaise: PaiseSchema,
  lateFeePaise: PaiseSchema,
  status: BillStatusSchema,
});
export type BillSummary = z.infer<typeof BillSummarySchema>;

export const BillSchema = BillSummarySchema.extend({
  lines: z.array(
    z.object({ type: BillLineTypeSchema, label: z.string(), amountPaise: PaiseSchema }),
  ),
  payments: z.array(
    z.object({
      paymentId: IdSchema,
      receiptNo: z.string(),
      paidOn: IsoDateSchema,
      method: PaymentMethodSchema,
      amountPaise: PaiseSchema,
    }),
  ),
  lateFeeWaived: z.boolean(),
  waivedReason: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
});
export type Bill = z.infer<typeof BillSchema>;

export const PaymentSummarySchema = z.object({
  id: IdSchema,
  flat: FlatRefSchema,
  amountPaise: PaiseSchema,
  paidOn: IsoDateSchema,
  method: PaymentMethodSchema,
  reference: z.string().nullable(),
  receiptNo: z.string(),
  status: PaymentStatusSchema,
  createdAt: IsoDateTimeSchema,
});
export type PaymentSummary = z.infer<typeof PaymentSummarySchema>;

export const PaymentSchema = PaymentSummarySchema.extend({
  notes: z.string().nullable(),
  recordedBy: ActorSchema,
  allocations: z.array(
    z.object({
      billId: IdSchema,
      title: z.string(),
      periodKey: z.string().nullable(),
      amountPaise: PaiseSchema,
    }),
  ),
  /** Kept as advance and used on the next bills. */
  unallocatedPaise: PaiseSchema,
  reversedReason: z.string().nullable(),
  canReverse: z.boolean(),
  /** Cheque photo, UPI screenshot or paper receipt the treasurer added. */
  proofs: z.array(FileRefSchema),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const FlatAccountSchema = z.object({
  flat: FlatRefSchema,
  outstandingPaise: PaiseSchema,
  /** Advance paid that no bill has used yet. */
  creditPaise: PaiseSchema,
  overdue: z.boolean(),
  nextDueDate: IsoDateSchema.nullable(),
  openBills: z.array(BillSummarySchema),
  recentPayments: z.array(PaymentSummarySchema),
});
export type FlatAccount = z.infer<typeof FlatAccountSchema>;

export const CollectionStatusSchema = z.enum(['PAID', 'DUE', 'OVERDUE', 'NO_BILLS']);
export type CollectionStatus = z.infer<typeof CollectionStatusSchema>;

export const CollectionSchema = z.object({
  financialYear: z.string(),
  /** False when the viewer only sees statuses (transparency STATUS). */
  showAmounts: z.boolean(),
  counts: z.object({
    flats: z.number().int(),
    paid: z.number().int(),
    due: z.number().int(),
    overdue: z.number().int(),
  }),
  /** This financial year. Null without amounts. */
  billedPaise: PaiseSchema.nullable(),
  collectedPaise: PaiseSchema.nullable(),
  outstandingPaise: PaiseSchema.nullable(),
  rows: z.array(
    z.object({
      flat: FlatRefSchema,
      status: CollectionStatusSchema,
      outstandingPaise: PaiseSchema.nullable(),
      lastPaidOn: IsoDateSchema.nullable(),
    }),
  ),
});
export type Collection = z.infer<typeof CollectionSchema>;

export const PaymentInstructionSchema = z.object({
  id: IdSchema,
  kind: PaymentInstructionKindSchema,
  label: z.string(),
  /** UPI id, or bank details as text. */
  value: z.string(),
  payeeName: z.string().nullable(),
  isActive: z.boolean(),
});
export type PaymentInstruction = z.infer<typeof PaymentInstructionSchema>;

/** A UPI id looks like name@bank. */
export const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;
