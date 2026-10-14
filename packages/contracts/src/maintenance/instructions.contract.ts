import { z } from 'zod';
import { OkSchema, SocietyParamsSchema } from '../core/common';
import { defineRoute } from '../core/route';
import { PaymentInstructionKindSchema, PaymentInstructionSchema } from './maintenance.schemas';
import { instructionParams, maintenanceModule } from './shared';

/** Ways to pay shown to members. Part of maintenanceContract. */
export const maintenanceInstructionRoutes = {
  listInstructions: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/maintenance/instructions',
    summary: 'How to pay: UPI ids and bank details. Members see active ones.',
    module: maintenanceModule,
    params: SocietyParamsSchema,
    response: z.array(PaymentInstructionSchema),
  }),
  createInstruction: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/maintenance/instructions',
    summary: 'Add a way to pay',
    module: maintenanceModule,
    permission: 'maintenance.settings.manage',
    params: SocietyParamsSchema,
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
    module: maintenanceModule,
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
    module: maintenanceModule,
    permission: 'maintenance.settings.manage',
    params: instructionParams,
    response: OkSchema,
  }),
};
