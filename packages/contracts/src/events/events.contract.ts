import { z } from 'zod';
import { AudienceSchema } from '../core/audience';
import {
  ActorSchema,
  CursorQuerySchema,
  FlatRefSchema,
  IdSchema,
  IsoDateTimeSchema,
  page,
} from '../core/common';
import { defineRoute } from '../core/route';
import { TimeframeSchema } from '../meetings/meetings.contract';

export const EventStatusSchema = z.enum(['PUBLISHED', 'CANCELLED']);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const RsvpResponseSchema = z.enum(['GOING', 'MAYBE', 'NOT_GOING']);
export type RsvpResponse = z.infer<typeof RsvpResponseSchema>;

export const MAX_RSVP_GUESTS = 10;

export const MyRsvpSchema = z.object({
  response: RsvpResponseSchema,
  guestsCount: z.number().int().min(0),
});
export type MyRsvp = z.infer<typeof MyRsvpSchema>;

export const EventSummarySchema = z.object({
  id: IdSchema,
  title: z.string(),
  startsAt: IsoDateTimeSchema,
  endsAt: IsoDateTimeSchema.nullable(),
  location: z.string().nullable(),
  status: EventStatusSchema,
  rsvpEnabled: z.boolean(),
  /** Members who said GOING plus their guests. */
  goingCount: z.number().int(),
  myRsvp: MyRsvpSchema.nullable(),
});
export type EventSummary = z.infer<typeof EventSummarySchema>;

export const RsvpCountsSchema = z.object({
  going: z.number().int(),
  maybe: z.number().int(),
  notGoing: z.number().int(),
  guests: z.number().int(),
});

export const EventSchema = EventSummarySchema.extend({
  description: z.string().nullable(),
  audience: AudienceSchema,
  counts: RsvpCountsSchema,
  createdBy: ActorSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type SocietyEvent = z.infer<typeof EventSchema>;

export const EventRsvpSchema = z.object({
  membershipId: IdSchema,
  displayName: z.string(),
  flats: z.array(FlatRefSchema),
  response: RsvpResponseSchema,
  guestsCount: z.number().int(),
  updatedAt: IsoDateTimeSchema,
});
export type EventRsvp = z.infer<typeof EventRsvpSchema>;

const societyParams = z.object({ societyId: IdSchema });
const eventParams = societyParams.extend({ eventId: IdSchema });

const EventInputSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(5000).nullable().optional(),
    location: z.string().trim().max(120).nullable().optional(),
    startsAt: IsoDateTimeSchema,
    endsAt: IsoDateTimeSchema.nullable().optional(),
    /** Omitted = the society's events.rsvpEnabledByDefault setting. */
    rsvpEnabled: z.boolean().optional(),
    audience: AudienceSchema.default({ type: 'ALL' }),
  })
  .strict();

export const eventsContract = {
  list: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/events',
    summary: 'Events for me. UPCOMING soonest first, PAST newest first.',
    module: 'events',
    params: societyParams,
    query: CursorQuerySchema.extend({ when: TimeframeSchema.default('UPCOMING') }),
    response: page(EventSummarySchema),
  }),
  get: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/events/:eventId',
    summary: 'One event with RSVP counts',
    module: 'events',
    params: eventParams,
    response: EventSchema,
  }),
  create: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/events',
    summary: 'Publish an event and notify the audience. A reminder goes out 1 day before.',
    module: 'events',
    permission: 'event.manage',
    params: societyParams,
    body: EventInputSchema,
    response: EventSchema,
  }),
  update: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/events/:eventId',
    summary: 'Edit an event. A new start time notifies the audience and resets the reminder.',
    module: 'events',
    permission: 'event.manage',
    params: eventParams,
    body: EventInputSchema.partial(),
    response: EventSchema,
  }),
  cancel: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/events/:eventId/cancel',
    summary: 'Cancel an event and notify the audience',
    module: 'events',
    permission: 'event.manage',
    params: eventParams,
    body: z.object({ reason: z.string().trim().min(1).max(500).optional() }).strict(),
    response: EventSchema,
  }),
  rsvp: defineRoute({
    method: 'PUT',
    path: '/v1/societies/:societyId/events/:eventId/rsvp',
    summary: 'Set my answer for an upcoming event',
    module: 'events',
    params: eventParams,
    body: z
      .object({
        response: RsvpResponseSchema,
        guestsCount: z.number().int().min(0).max(MAX_RSVP_GUESTS).default(0),
      })
      .strict(),
    response: EventSchema,
  }),
  listRsvps: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/events/:eventId/rsvps',
    summary: 'Who answered, for organisers',
    module: 'events',
    permission: 'event.manage',
    params: eventParams,
    response: z.array(EventRsvpSchema),
  }),
};
