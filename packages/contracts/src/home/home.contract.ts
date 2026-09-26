import { z } from 'zod';
import { FlatRefSchema, IdSchema, IsoDateTimeSchema } from '../core/common';
import { defineRoute } from '../core/route';
import { AlertTypeSchema } from '../emergency/emergency.contract';
import { MemberFlatSchema, SocietySummarySchema } from '../me/me.contract';
import { NoticeSummarySchema } from '../notices/notices.contract';

/**
 * Things that need the user's attention today. The app renders each type it knows and ignores the rest,
 * so new types can ship on the server before the app updates.
 */
export const AttentionItemSchema = z.discriminatedUnion('type', [
  /** Always first. The app renders it in the danger style. */
  z.object({
    type: z.literal('ACTIVE_ALERT'),
    alertId: IdSchema,
    alertType: AlertTypeSchema,
    flat: FlatRefSchema.nullable(),
    raisedByName: z.string().nullable(),
    createdAt: IsoDateTimeSchema,
  }),
  z.object({ type: z.literal('JOIN_REQUESTS_PENDING'), count: z.number().int() }),
  z.object({ type: z.literal('INVITATIONS_PENDING'), count: z.number().int() }),
  z.object({ type: z.literal('VENDOR_SUGGESTIONS'), count: z.number().int() }),
  z.object({
    type: z.literal('IMPORTANT_NOTICE'),
    noticeId: IdSchema,
    title: z.string(),
    priority: z.enum(['IMPORTANT', 'EMERGENCY']),
  }),
  z.object({ type: z.literal('PROFILE_INCOMPLETE'), missing: z.array(z.enum(['email', 'phone'])) }),
]);
export type AttentionItem = z.infer<typeof AttentionItemSchema>;

export const HomeSummarySchema = z.object({
  generatedAt: IsoDateTimeSchema,
  society: SocietySummarySchema,
  flats: z.array(MemberFlatSchema),
  attention: z.array(AttentionItemSchema),
  notices: z.array(NoticeSummarySchema),
  unreadNotifications: z.number().int(),
});
export type HomeSummary = z.infer<typeof HomeSummarySchema>;

export const homeContract = {
  summary: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/home',
    summary: 'What matters today for this member in this society',
    params: z.object({ societyId: IdSchema }),
    response: HomeSummarySchema,
  }),
};
