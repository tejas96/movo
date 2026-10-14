import { z } from 'zod';
import { IdSchema, SocietyParamsSchema } from '../core/common';

/** Helpers shared by the market route files. Not part of the public package API. */
export const listingParams = SocietyParamsSchema.extend({ listingId: IdSchema });
export const orderParams = SocietyParamsSchema.extend({ orderId: IdSchema });
export const marketModule = 'marketplace' as const;
export const reasonBody = z.object({ reason: z.string().trim().min(2).max(300) }).strict();
export const optionalReasonBody = z
  .object({ reason: z.string().trim().max(300).optional() })
  .strict();
