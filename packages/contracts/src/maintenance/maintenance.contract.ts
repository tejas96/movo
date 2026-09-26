import { z } from 'zod';
import {
  ActorSchema,
  CursorQuerySchema,
  FlatRefSchema,
  IdSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  OkSchema,
  PaiseSchema,
  page,
} from '../core/common';
import { defineRoute } from '../core/route';

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

const societyParams = z.object({ societyId: IdSchema });
const planParams = societyParams.extend({ planId: IdSchema });
const billParams = societyParams.extend({ billId: IdSchema });
const paymentParams = societyParams.extend({ paymentId: IdSchema });
const flatParams = societyParams.extend({ flatId: IdSchema });
const instructionParams = societyParams.extend({ instructionId: IdSchema });

const PlanInputSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    frequency: BillingFrequencySchema.default('MONTHLY'),
    amountRule: AmountRuleSchema.default('FLAT_RATE'),
    amountPaise: PaiseSchema.min(1).max(100_000_000),
    dueDay: z.number().int().min(1).max(28).default(10),
    generateDaysBefore: z.number().int().min(0).max(31).default(7),
    lateFee: LateFeeRuleSchema.default({ type: 'NONE' }),
    activeFrom: IsoDateSchema,
    activeTo: IsoDateSchema.nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .strict();

const ReasonSchema = z.object({ reason: z.string().trim().min(2).max(300) }).strict();

const m = 'maintenance' as const;

export const maintenanceContract = {
  myDues: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/me',
    summary: 'Dues, advance and recent payments for each of my flats',
    module: m,
    params: societyParams,
    response: z.object({ flats: z.array(FlatAccountSchema) }),
  }),
  flatAccount: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/flats/:flatId',
    summary: 'One flat’s account. Members of the flat, or maintenance.view_all.',
    module: m,
    params: flatParams,
    response: FlatAccountSchema,
  }),
  listBills: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/bills',
    summary: 'Bills, newest due first. Members see their own flats.',
    module: m,
    params: societyParams,
    query: CursorQuerySchema.extend({
      flatId: IdSchema.optional(),
      open: z.enum(['true', 'false']).optional(),
    }),
    response: page(BillSummarySchema),
  }),
  getBill: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/bills/:billId',
    summary: 'One bill with lines and payments',
    module: m,
    params: billParams,
    response: BillSchema,
  }),
  generateBills: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/maintenance/bills/generate',
    summary: 'Create bills that are due now for every active plan. Safe to run again.',
    module: m,
    permission: 'maintenance.generate_bills',
    params: societyParams,
    response: z.object({ created: z.number().int(), skippedFlats: z.array(FlatRefSchema) }),
  }),
  createAdhocBills: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/maintenance/bills/adhoc',
    summary: 'One-off bill, like a repair fund, for all flats or chosen flats',
    module: m,
    permission: 'maintenance.generate_bills',
    params: societyParams,
    body: z
      .object({
        title: z.string().trim().min(2).max(80),
        amountPaise: PaiseSchema.min(1).max(100_000_000),
        dueDate: IsoDateSchema,
        /** Omitted = every active flat. */
        flatIds: z.array(IdSchema).min(1).max(1000).optional(),
      })
      .strict(),
    response: z.object({ created: z.number().int() }),
  }),
  waiveBill: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/maintenance/bills/:billId/waive',
    summary: 'Waive what is left on a bill',
    module: m,
    permission: 'maintenance.waive',
    params: billParams,
    body: ReasonSchema,
    response: BillSchema,
  }),
  waiveLateFee: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/maintenance/bills/:billId/waive-late-fee',
    summary: 'Remove the late fee from a bill for good',
    module: m,
    permission: 'maintenance.waive',
    params: billParams,
    body: ReasonSchema,
    response: BillSchema,
  }),
  listPayments: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/payments',
    summary: 'Payments, newest first. Members see their own flats.',
    module: m,
    params: societyParams,
    query: CursorQuerySchema.extend({ flatId: IdSchema.optional() }),
    response: page(PaymentSummarySchema),
  }),
  getPayment: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/payments/:paymentId',
    summary: 'One payment. This is the receipt.',
    module: m,
    params: paymentParams,
    response: PaymentSchema,
  }),
  recordPayment: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/maintenance/payments',
    summary:
      'Record money received. Goes to the oldest open bills unless allocations are given; the rest is kept as advance. A repeated idempotencyKey returns the first payment.',
    module: m,
    permission: 'maintenance.record_payment',
    params: societyParams,
    body: z
      .object({
        flatId: IdSchema,
        amountPaise: PaiseSchema.min(1).max(100_000_000),
        paidOn: IsoDateSchema,
        method: PaymentMethodSchema,
        reference: z.string().trim().max(80).nullable().optional(),
        notes: z.string().trim().max(500).nullable().optional(),
        allocations: z
          .array(z.object({ billId: IdSchema, amountPaise: PaiseSchema.min(1) }).strict())
          .max(50)
          .optional(),
        idempotencyKey: z.string().min(8).max(64),
      })
      .strict(),
    response: PaymentSchema,
  }),
  reversePayment: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/maintenance/payments/:paymentId/reverse',
    summary:
      'Undo a payment entered by mistake. The recorder can do it for 10 minutes; later it needs maintenance.waive.',
    module: m,
    permission: 'maintenance.record_payment',
    params: paymentParams,
    body: ReasonSchema,
    response: PaymentSchema,
  }),
  collection: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/collection',
    summary:
      'Who has paid. maintenance.view_all sees amounts; other members only when the transparency setting allows.',
    module: m,
    params: societyParams,
    response: CollectionSchema,
  }),
  listPlans: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/plans',
    summary: 'Billing plans',
    module: m,
    permission: 'maintenance.view_all',
    params: societyParams,
    response: z.array(BillingPlanSchema),
  }),
  createPlan: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/maintenance/plans',
    summary: 'Add a billing plan',
    module: m,
    permission: 'maintenance.settings.manage',
    params: societyParams,
    body: PlanInputSchema,
    response: BillingPlanSchema,
  }),
  updatePlan: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/maintenance/plans/:planId',
    summary: 'Edit a plan. Bills already made keep their amounts.',
    module: m,
    permission: 'maintenance.settings.manage',
    params: planParams,
    body: PlanInputSchema.partial(),
    response: BillingPlanSchema,
  }),
  setPlanOverride: defineRoute({
    method: 'PUT',
    path: '/v1/societies/:societyId/maintenance/plans/:planId/overrides',
    summary: 'A different amount for one flat. amountPaise null removes it.',
    module: m,
    permission: 'maintenance.settings.manage',
    params: planParams,
    body: z.object({ flatId: IdSchema, amountPaise: PaiseSchema.nullable() }).strict(),
    response: BillingPlanSchema,
  }),
  listInstructions: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/instructions',
    summary: 'How to pay: UPI ids and bank details. Members see active ones.',
    module: m,
    params: societyParams,
    response: z.array(PaymentInstructionSchema),
  }),
  createInstruction: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/maintenance/instructions',
    summary: 'Add a way to pay',
    module: m,
    permission: 'maintenance.settings.manage',
    params: societyParams,
    body: z
      .object({
        kind: PaymentInstructionKindSchema,
        label: z.string().trim().min(2).max(60),
        value: z.string().trim().min(3).max(500),
        payeeName: z.string().trim().max(60).nullable().optional(),
        isActive: z.boolean().default(true),
      })
      .strict(),
    response: PaymentInstructionSchema,
  }),
  updateInstruction: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/maintenance/instructions/:instructionId',
    summary: 'Edit a way to pay',
    module: m,
    permission: 'maintenance.settings.manage',
    params: instructionParams,
    body: z
      .object({
        label: z.string().trim().min(2).max(60).optional(),
        value: z.string().trim().min(3).max(500).optional(),
        payeeName: z.string().trim().max(60).nullable().optional(),
        isActive: z.boolean().optional(),
      })
      .strict(),
    response: PaymentInstructionSchema,
  }),
  deleteInstruction: defineRoute({
    method: 'DELETE',
    path: '/v1/societies/:societyId/maintenance/instructions/:instructionId',
    summary: 'Remove a way to pay',
    module: m,
    permission: 'maintenance.settings.manage',
    params: instructionParams,
    response: OkSchema,
  }),
};

/** A UPI id looks like name@bank. */
export const UPI_ID = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;
