import { z } from 'zod';
import { ActorSchema, IdSchema, IsoDateSchema, IsoDateTimeSchema } from '../core/common';
import { defineRoute } from '../core/route';

export const DutyPeriodUnitSchema = z.enum(['DAY', 'WEEK', 'MONTH']);
export type DutyPeriodUnit = z.infer<typeof DutyPeriodUnitSchema>;
export const DutyParticipantKindSchema = z.enum(['FLAT', 'MEMBER']);
export type DutyParticipantKind = z.infer<typeof DutyParticipantKindSchema>;
export const DutyStatusSchema = z.enum(['ACTIVE', 'PAUSED', 'ENDED']);
export type DutyStatus = z.infer<typeof DutyStatusSchema>;
/** MARK_MISSED moves on. CARRY_OVER gives the same participant the next period too. */
export const DutyOnMissSchema = z.enum(['MARK_MISSED', 'CARRY_OVER']);
export const AssignmentStatusSchema = z.enum([
  'UPCOMING',
  'ACTIVE',
  'COMPLETED',
  'MISSED',
  'SKIPPED',
]);
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;

export const DutyParticipantSchema = z.object({
  /** A flat id or a membership id, by the duty's participant kind. */
  id: IdSchema,
  label: z.string(),
});
export type DutyParticipant = z.infer<typeof DutyParticipantSchema>;

export const DutyAssignmentSchema = z.object({
  id: IdSchema,
  periodIndex: z.number().int(),
  periodStart: IsoDateSchema,
  periodEnd: IsoDateSchema,
  participant: DutyParticipantSchema,
  status: AssignmentStatusSchema,
  confirmedAt: IsoDateTimeSchema.nullable(),
  confirmedBy: ActorSchema.nullable(),
  /** Set when a committee member skipped, reassigned or completed it. */
  overrideNote: z.string().nullable(),
  /** This assignment is the viewer's (their flat or themselves). */
  mine: z.boolean(),
});
export type DutyAssignment = z.infer<typeof DutyAssignmentSchema>;

export const DutySummarySchema = z.object({
  id: IdSchema,
  title: z.string(),
  participantKind: DutyParticipantKindSchema,
  periodUnit: DutyPeriodUnitSchema,
  periodLength: z.number().int(),
  requiresConfirmation: z.boolean(),
  status: DutyStatusSchema,
  points: z.number().int().nullable(),
  current: DutyAssignmentSchema.nullable(),
  next: DutyAssignmentSchema.nullable(),
});
export type DutySummary = z.infer<typeof DutySummarySchema>;

export const DutySchema = DutySummarySchema.extend({
  description: z.string().nullable(),
  startDate: IsoDateSchema,
  onMiss: DutyOnMissSchema,
  participants: z.array(DutyParticipantSchema),
  /** The next periods after the current one. */
  upcoming: z.array(DutyAssignmentSchema),
  /** Finished periods, newest first. */
  history: z.array(DutyAssignmentSchema),
  createdAt: IsoDateTimeSchema,
});
export type Duty = z.infer<typeof DutySchema>;

const societyParams = z.object({ societyId: IdSchema });
const dutyParams = societyParams.extend({ dutyId: IdSchema });
const assignmentParams = dutyParams.extend({ assignmentId: IdSchema });

const ParticipantIdsSchema = z
  .array(IdSchema)
  .min(1)
  .max(500)
  .refine((ids) => new Set(ids).size === ids.length, 'Each participant once');

const r = 'responsibilities' as const;

export const dutiesContract = {
  list: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/duties',
    summary: 'Duties with the current and next turn. mine=true keeps the ones I take part in.',
    module: r,
    params: societyParams,
    query: z.object({ mine: z.enum(['true', 'false']).optional() }),
    response: z.array(DutySummarySchema),
  }),
  get: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/duties/:dutyId',
    summary: 'One duty with its order, upcoming turns and history',
    module: r,
    params: dutyParams,
    response: DutySchema,
  }),
  create: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/duties',
    summary: 'Create a rotation. Turns are planned 12 periods ahead.',
    module: r,
    permission: 'duty.manage',
    params: societyParams,
    body: z
      .object({
        title: z.string().trim().min(2).max(80),
        description: z.string().trim().max(1000).nullable().optional(),
        participantKind: DutyParticipantKindSchema.default('FLAT'),
        participantIds: ParticipantIdsSchema,
        periodUnit: DutyPeriodUnitSchema.default('MONTH'),
        periodLength: z.number().int().min(1).max(12).default(1),
        startDate: IsoDateSchema,
        /** Omitted = the society's responsibilities.defaultRequiresConfirmation. */
        requiresConfirmation: z.boolean().optional(),
        onMiss: DutyOnMissSchema.default('MARK_MISSED'),
        points: z.number().int().min(1).max(100).nullable().optional(),
      })
      .strict(),
    response: DutySchema,
  }),
  update: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/duties/:dutyId',
    summary: 'Rename or change the rules. The schedule stays.',
    module: r,
    permission: 'duty.manage',
    params: dutyParams,
    body: z
      .object({
        title: z.string().trim().min(2).max(80).optional(),
        description: z.string().trim().max(1000).nullable().optional(),
        requiresConfirmation: z.boolean().optional(),
        onMiss: DutyOnMissSchema.optional(),
        points: z.number().int().min(1).max(100).nullable().optional(),
      })
      .strict(),
    response: DutySchema,
  }),
  setParticipants: defineRoute({
    method: 'PUT',
    path: '/v1/societies/:societyId/duties/:dutyId/participants',
    summary:
      'New order of participants. Upcoming turns are planned again after whoever had the last one.',
    module: r,
    permission: 'duty.manage',
    params: dutyParams,
    body: z.object({ participantIds: ParticipantIdsSchema }).strict(),
    response: DutySchema,
  }),
  setStatus: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/duties/:dutyId/status',
    summary: 'Pause, resume or end a duty',
    module: r,
    permission: 'duty.manage',
    params: dutyParams,
    body: z.object({ status: DutyStatusSchema }).strict(),
    response: DutySchema,
  }),
  confirm: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/duties/:dutyId/assignments/:assignmentId/confirm',
    summary: 'Mark my current turn as done',
    module: r,
    params: assignmentParams,
    response: DutySchema,
  }),
  override: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/duties/:dutyId/assignments/:assignmentId/override',
    summary: 'Skip a turn, give it to someone else, or mark it done for them',
    module: r,
    permission: 'duty.override',
    params: assignmentParams,
    body: z
      .object({
        action: z.enum(['SKIP', 'REASSIGN', 'COMPLETE']),
        participantId: IdSchema.optional(),
        reason: z.string().trim().min(2).max(300),
      })
      .strict(),
    response: DutySchema,
  }),
};
