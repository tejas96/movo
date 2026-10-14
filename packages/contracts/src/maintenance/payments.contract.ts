import { z } from 'zod';
import {
  CursorQuerySchema,
  IdSchema,
  IsoDateSchema,
  PaiseSchema,
  page,
  SocietyParamsSchema,
} from '../core/common';
import { defineRoute } from '../core/route';
import { MAX_PAYMENT_PROOFS } from '../files/files.contract';
import {
  CollectionSchema,
  PaymentMethodSchema,
  PaymentSchema,
  PaymentSummarySchema,
} from './maintenance.schemas';
import { maintenanceModule, paymentParams, ReasonSchema } from './shared';

/** Payments and the collection report. Part of maintenanceContract. */
export const maintenancePaymentRoutes = {
  listPayments: defineRoute({
    method: 'GET',
    path: '/societies/:societyId/maintenance/payments',
    summary: 'Payments, newest first. Members see their own flats.',
    module: maintenanceModule,
    params: SocietyParamsSchema,
    query: CursorQuerySchema.extend({ flatId: IdSchema.optional() }),
    response: page(PaymentSummarySchema),
  }),
  getPayment: defineRoute({
    method: 'GET',
    path: '/societies/:societyId/maintenance/payments/:paymentId',
    summary: 'One payment. This is the receipt.',
    module: maintenanceModule,
    params: paymentParams,
    response: PaymentSchema,
  }),
  recordPayment: defineRoute({
    method: 'POST',
    path: '/societies/:societyId/maintenance/payments',
    summary:
      'Record money received. Goes to the oldest open bills unless allocations are given; the rest is kept as advance. A repeated idempotencyKey returns the first payment.',
    module: maintenanceModule,
    permission: 'maintenance.record_payment',
    params: SocietyParamsSchema,
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
        /** PAYMENT_PROOF uploads. */
        proofIds: z.array(IdSchema).max(MAX_PAYMENT_PROOFS).optional(),
        idempotencyKey: z.string().min(8).max(64),
      })
      .strict(),
    response: PaymentSchema,
  }),
  reversePayment: defineRoute({
    method: 'POST',
    path: '/societies/:societyId/maintenance/payments/:paymentId/reverse',
    summary:
      'Undo a payment entered by mistake. The recorder can do it for 10 minutes; later it needs maintenance.waive.',
    module: maintenanceModule,
    permission: 'maintenance.record_payment',
    params: paymentParams,
    body: ReasonSchema,
    response: PaymentSchema,
  }),
  collection: defineRoute({
    method: 'GET',
    path: '/societies/:societyId/maintenance/collection',
    summary:
      'Who has paid. maintenance.view_all sees amounts; other members only when the transparency setting allows.',
    module: maintenanceModule,
    params: SocietyParamsSchema,
    response: CollectionSchema,
  }),
};
