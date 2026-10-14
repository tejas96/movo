import { z } from 'zod';
import {
  CursorQuerySchema,
  FlatRefSchema,
  IdSchema,
  IsoDateSchema,
  PaiseSchema,
  page,
  SocietyParamsSchema,
} from '../core/common';
import { defineRoute } from '../core/route';
import { BillSchema, BillSummarySchema, FlatAccountSchema } from './maintenance.schemas';
import { billParams, flatParams, maintenanceModule, ReasonSchema } from './shared';

/** Dues, bills and bill generation. Part of maintenanceContract. */
export const maintenanceBillRoutes = {
  myDues: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/me',
    summary: 'Dues, advance and recent payments for each of my flats',
    module: maintenanceModule,
    params: SocietyParamsSchema,
    response: z.object({ flats: z.array(FlatAccountSchema) }),
  }),
  flatAccount: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/flats/:flatId',
    summary: 'One flat’s account. Members of the flat, or maintenance.view_all.',
    module: maintenanceModule,
    params: flatParams,
    response: FlatAccountSchema,
  }),
  listBills: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/bills',
    summary: 'Bills, newest due first. Members see their own flats.',
    module: maintenanceModule,
    params: SocietyParamsSchema,
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
    module: maintenanceModule,
    params: billParams,
    response: BillSchema,
  }),
  generateBills: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/maintenance/bills/generate',
    summary: 'Create bills that are due now for every active plan. Safe to run again.',
    module: maintenanceModule,
    permission: 'maintenance.generate_bills',
    params: SocietyParamsSchema,
    response: z.object({ created: z.number().int(), skippedFlats: z.array(FlatRefSchema) }),
  }),
  createAdhocBills: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/maintenance/bills/adhoc',
    summary: 'One-off bill, like a repair fund, for all flats or chosen flats',
    module: maintenanceModule,
    permission: 'maintenance.generate_bills',
    params: SocietyParamsSchema,
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
    module: maintenanceModule,
    permission: 'maintenance.waive',
    params: billParams,
    body: ReasonSchema,
    response: BillSchema,
  }),
  waiveLateFee: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/maintenance/bills/:billId/waive-late-fee',
    summary: 'Remove the late fee from a bill for good',
    module: maintenanceModule,
    permission: 'maintenance.waive',
    params: billParams,
    body: ReasonSchema,
    response: BillSchema,
  }),
};
