import { z } from 'zod';
import { IdSchema, SocietyParamsSchema } from '../core/common';

/** Helpers shared by the maintenance route files. Not part of the public package API. */
export const planParams = SocietyParamsSchema.extend({ planId: IdSchema });
export const billParams = SocietyParamsSchema.extend({ billId: IdSchema });
export const paymentParams = SocietyParamsSchema.extend({ paymentId: IdSchema });
export const flatParams = SocietyParamsSchema.extend({ flatId: IdSchema });
export const instructionParams = SocietyParamsSchema.extend({ instructionId: IdSchema });

export const ReasonSchema = z.object({ reason: z.string().trim().min(2).max(300) }).strict();

export const maintenanceModule = 'maintenance' as const;
