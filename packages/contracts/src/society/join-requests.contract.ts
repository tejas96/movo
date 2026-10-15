import { z } from 'zod';
import {
  EmailSchema,
  IdSchema,
  IsoDateTimeSchema,
  OkSchema,
  PhoneSchema,
  SocietyParamsSchema,
} from '../core/common';
import { JoinRequestStatusSchema, OccupancyRelationSchema } from '../core/enums';
import { defineRoute } from '../core/route';
import { MemberCardSchema } from './members.contract';

export const JoinRequestSchema = z.object({
  id: IdSchema,
  user: z.object({
    id: IdSchema,
    displayName: z.string(),
    phone: PhoneSchema.nullable(),
    email: EmailSchema.nullable(),
  }),
  flat: z.object({ id: IdSchema, number: z.string(), buildingName: z.string().nullable() }),
  relationClaimed: OccupancyRelationSchema,
  message: z.string().nullable(),
  status: JoinRequestStatusSchema,
  createdAt: IsoDateTimeSchema,
  /** Approve or reject: member.manage and the request is pending. */
  canDecide: z.boolean(),
});
export type JoinRequest = z.infer<typeof JoinRequestSchema>;

/** Join requests from people who used the society join code. Part of societyContract. */
export const societyJoinRequestRoutes = {
  listJoinRequests: defineRoute({
    method: 'GET',
    path: '/societies/:societyId/join-requests',
    summary: 'Join requests waiting for a decision',
    permission: 'member.manage',
    params: SocietyParamsSchema,
    query: z.object({ status: JoinRequestStatusSchema.default('PENDING') }),
    response: z.array(JoinRequestSchema),
  }),
  approveJoinRequest: defineRoute({
    method: 'POST',
    path: '/societies/:societyId/join-requests/:requestId/approve',
    summary: 'Approve a join request. Creates the membership and the flat occupancy.',
    permission: 'member.manage',
    params: SocietyParamsSchema.extend({ requestId: IdSchema }),
    body: z
      .object({ roleId: IdSchema.optional(), relation: OccupancyRelationSchema.optional() })
      .strict(),
    response: MemberCardSchema,
  }),
  rejectJoinRequest: defineRoute({
    method: 'POST',
    path: '/societies/:societyId/join-requests/:requestId/reject',
    summary: 'Reject a join request',
    permission: 'member.manage',
    params: SocietyParamsSchema.extend({ requestId: IdSchema }),
    body: z.object({ reason: z.string().trim().max(200).optional() }).strict(),
    response: OkSchema,
  }),
};
