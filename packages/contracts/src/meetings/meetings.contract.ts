import { z } from 'zod';
import { AudienceSchema } from '../core/audience';
import { ActorSchema, CursorQuerySchema, IdSchema, IsoDateTimeSchema, page } from '../core/common';
import { defineRoute } from '../core/route';

export const MeetingStatusSchema = z.enum(['SCHEDULED', 'CANCELLED', 'COMPLETED']);
export type MeetingStatus = z.infer<typeof MeetingStatusSchema>;

export const MeetingUpdateKindSchema = z.enum(['RESCHEDULED', 'NOTE', 'CANCELLED', 'COMPLETED']);
export type MeetingUpdateKind = z.infer<typeof MeetingUpdateKindSchema>;

/** UPCOMING = not completed and not over yet (cancelled ones stay visible until their time). */
export const TimeframeSchema = z.enum(['UPCOMING', 'PAST']);
export type Timeframe = z.infer<typeof TimeframeSchema>;

export const MeetingSummarySchema = z.object({
  id: IdSchema,
  title: z.string(),
  startsAt: IsoDateTimeSchema,
  endsAt: IsoDateTimeSchema.nullable(),
  location: z.string().nullable(),
  status: MeetingStatusSchema,
});
export type MeetingSummary = z.infer<typeof MeetingSummarySchema>;

export const MeetingUpdateSchema = z.object({
  id: IdSchema,
  kind: MeetingUpdateKindSchema,
  body: z.string().nullable(),
  /** For RESCHEDULED: the start time before the change. */
  previousStartsAt: IsoDateTimeSchema.nullable(),
  createdBy: ActorSchema,
  createdAt: IsoDateTimeSchema,
});
export type MeetingUpdate = z.infer<typeof MeetingUpdateSchema>;

export const MeetingSchema = MeetingSummarySchema.extend({
  agenda: z.string().nullable(),
  audience: AudienceSchema,
  createdBy: ActorSchema,
  /** Newest first. */
  updates: z.array(MeetingUpdateSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Meeting = z.infer<typeof MeetingSchema>;

const societyParams = z.object({ societyId: IdSchema });
const meetingParams = societyParams.extend({ meetingId: IdSchema });

const MeetingInputSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    agenda: z.string().trim().max(5000).nullable().optional(),
    location: z.string().trim().max(120).nullable().optional(),
    startsAt: IsoDateTimeSchema,
    endsAt: IsoDateTimeSchema.nullable().optional(),
    audience: AudienceSchema.default({ type: 'ALL' }),
  })
  .strict();

const NoteSchema = z.object({ note: z.string().trim().min(1).max(1000).optional() }).strict();

export const meetingsContract = {
  list: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/meetings',
    summary: 'Meetings for me. UPCOMING soonest first, PAST newest first.',
    module: 'meetings',
    params: societyParams,
    query: CursorQuerySchema.extend({ when: TimeframeSchema.default('UPCOMING') }),
    response: page(MeetingSummarySchema),
  }),
  get: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/meetings/:meetingId',
    summary: 'One meeting with its updates',
    module: 'meetings',
    params: meetingParams,
    response: MeetingSchema,
  }),
  create: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/meetings',
    summary: 'Schedule a meeting and notify the audience. Reminders follow the society settings.',
    module: 'meetings',
    permission: 'meeting.manage',
    params: societyParams,
    body: MeetingInputSchema,
    response: MeetingSchema,
  }),
  update: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/meetings/:meetingId',
    summary:
      'Edit a scheduled meeting. A new start time is recorded as RESCHEDULED, notifies the audience and resets reminders.',
    module: 'meetings',
    permission: 'meeting.manage',
    params: meetingParams,
    body: MeetingInputSchema.partial().extend(NoteSchema.shape).strict(),
    response: MeetingSchema,
  }),
  addNote: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/meetings/:meetingId/notes',
    summary: 'Post a short update, like a venue change, and notify the audience',
    module: 'meetings',
    permission: 'meeting.manage',
    params: meetingParams,
    body: z.object({ note: z.string().trim().min(1).max(1000) }).strict(),
    response: MeetingSchema,
  }),
  cancel: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/meetings/:meetingId/cancel',
    summary: 'Cancel a scheduled meeting and notify the audience',
    module: 'meetings',
    permission: 'meeting.manage',
    params: meetingParams,
    body: NoteSchema,
    response: MeetingSchema,
  }),
  complete: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/meetings/:meetingId/complete',
    summary: 'Mark a meeting as held. Minutes and attendance come later.',
    module: 'meetings',
    permission: 'meeting.manage',
    params: meetingParams,
    body: NoteSchema,
    response: MeetingSchema,
  }),
};
