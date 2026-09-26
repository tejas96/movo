import { z } from 'zod';
import { ActorSchema, IdSchema, IsoDateTimeSchema } from '../core/common';
import { defineRoute } from '../core/route';

export const PointsReasonSchema = z.enum(['TASK', 'DUTY', 'ADJUSTMENT']);
export type PointsReason = z.infer<typeof PointsReasonSchema>;

export const PointsEntrySchema = z.object({
  id: IdSchema,
  delta: z.number().int(),
  reason: PointsReasonSchema,
  /** Task or duty title, or the adjustment note. */
  label: z.string(),
  refId: IdSchema.nullable(),
  financialYear: z.string(),
  by: ActorSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type PointsEntry = z.infer<typeof PointsEntrySchema>;

export const MemberPointsSchema = z.object({
  membershipId: IdSchema,
  displayName: z.string(),
  financialYear: z.string(),
  /** This financial year. */
  points: z.number().int(),
  allTimePoints: z.number().int(),
  /** Place on this year's board, when the society shows one. */
  rank: z.number().int().nullable(),
  entries: z.array(PointsEntrySchema),
});
export type MemberPoints = z.infer<typeof MemberPointsSchema>;

export const LeaderboardSchema = z.object({
  financialYear: z.string(),
  rows: z.array(
    z.object({
      rank: z.number().int(),
      membershipId: IdSchema,
      displayName: z.string(),
      flat: z.string().nullable(),
      points: z.number().int(),
    }),
  ),
});
export type Leaderboard = z.infer<typeof LeaderboardSchema>;

const societyParams = z.object({ societyId: IdSchema });

const w = 'rewards' as const;

export const rewardsContract = {
  mine: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/rewards/me',
    summary: 'My points this year, all time, and history',
    module: w,
    params: societyParams,
    response: MemberPointsSchema,
  }),
  member: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/rewards/members/:membershipId',
    summary: 'A member’s points, for reward.adjust',
    module: w,
    permission: 'reward.adjust',
    params: societyParams.extend({ membershipId: IdSchema }),
    response: MemberPointsSchema,
  }),
  leaderboard: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/rewards/leaderboard',
    summary: 'This year’s top contributors, by the rewards.leaderboard setting',
    module: w,
    params: societyParams,
    response: LeaderboardSchema,
  }),
  adjust: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/rewards/adjustments',
    summary: 'Add or take away points with a note',
    module: w,
    permission: 'reward.adjust',
    params: societyParams,
    body: z
      .object({
        membershipId: IdSchema,
        delta: z
          .number()
          .int()
          .min(-1000)
          .max(1000)
          .refine((n) => n !== 0, 'Not zero'),
        note: z.string().trim().min(2).max(200),
      })
      .strict(),
    response: MemberPointsSchema,
  }),
};
