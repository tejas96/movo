import { z } from 'zod';
import { IdSchema, IsoDateSchema, PaiseSchema, SocietyParamsSchema } from '../core/common';
import { defineRoute } from '../core/route';
import {
  AmountRuleSchema,
  BillingFrequencySchema,
  BillingPlanSchema,
  LateFeeRuleSchema,
} from './maintenance.schemas';
import { maintenanceModule, planParams } from './shared';

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

/** Billing plans. Part of maintenanceContract. */
export const maintenancePlanRoutes = {
  listPlans: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/plans',
    summary: 'Billing plans',
    module: maintenanceModule,
    permission: 'maintenance.view_all',
    params: SocietyParamsSchema,
    response: z.array(BillingPlanSchema),
  }),
  createPlan: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/maintenance/plans',
    summary: 'Add a billing plan',
    module: maintenanceModule,
    permission: 'maintenance.settings.manage',
    params: SocietyParamsSchema,
    body: PlanInputSchema,
    response: BillingPlanSchema,
  }),
  updatePlan: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/maintenance/plans/:planId',
    summary: 'Edit a plan. Bills already made keep their amounts.',
    module: maintenanceModule,
    permission: 'maintenance.settings.manage',
    params: planParams,
    body: PlanInputSchema.partial(),
    response: BillingPlanSchema,
  }),
  setPlanOverride: defineRoute({
    method: 'PUT',
    path: '/v1/societies/:societyId/maintenance/plans/:planId/overrides',
    summary: 'A different amount for one flat. amountPaise null removes it.',
    module: maintenanceModule,
    permission: 'maintenance.settings.manage',
    params: planParams,
    body: z.object({ flatId: IdSchema, amountPaise: PaiseSchema.nullable() }).strict(),
    response: BillingPlanSchema,
  }),
};
