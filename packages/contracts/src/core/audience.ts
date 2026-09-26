import { z } from 'zod';
import { IdSchema } from './common';

/** Who a notice, meeting or event is for. Shared by every communication module. */
export const AudienceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ALL') }).strict(),
  z.object({ type: z.literal('ROLES'), ids: z.array(IdSchema).min(1).max(20) }).strict(),
  z.object({ type: z.literal('BUILDINGS'), ids: z.array(IdSchema).min(1).max(50) }).strict(),
  z.object({ type: z.literal('FLATS'), ids: z.array(IdSchema).min(1).max(500) }).strict(),
]);
export type Audience = z.infer<typeof AudienceSchema>;
export const AUDIENCE_ALL: Audience = { type: 'ALL' };
