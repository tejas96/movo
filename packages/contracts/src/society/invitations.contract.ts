import { z } from 'zod';
import {
  CursorQuerySchema,
  DisplayNameSchema,
  EmailSchema,
  IdSchema,
  IsoDateTimeSchema,
  OkSchema,
  PhoneSchema,
  page,
  SocietyParamsSchema,
} from '../core/common';
import { InvitationStatusSchema, OccupancyRelationSchema } from '../core/enums';
import { defineRoute } from '../core/route';
import { RoleSummarySchema } from '../me/me.contract';

export const InvitationSchema = z.object({
  id: IdSchema,
  code: z.string(),
  inviteeName: z.string(),
  phone: PhoneSchema.nullable(),
  email: EmailSchema.nullable(),
  flat: z
    .object({ id: IdSchema, number: z.string(), buildingName: z.string().nullable() })
    .nullable(),
  role: RoleSummarySchema,
  relation: OccupancyRelationSchema,
  status: InvitationStatusSchema,
  expiresAt: IsoDateTimeSchema,
  createdAt: IsoDateTimeSchema,
  invitedBy: z.object({ membershipId: IdSchema, displayName: z.string() }),
  /** member.manage and the invitation is still pending (not used, revoked or expired). */
  canRevoke: z.boolean(),
});
export type Invitation = z.infer<typeof InvitationSchema>;

/** Invitations to join a society. Part of societyContract. */
export const societyInvitationRoutes = {
  listInvitations: defineRoute({
    method: 'GET',
    path: '/societies/:societyId/invitations',
    summary: 'Invitations, newest first',
    permission: 'member.manage',
    params: SocietyParamsSchema,
    query: CursorQuerySchema.extend({ status: InvitationStatusSchema.optional() }),
    response: page(InvitationSchema),
  }),
  createInvitation: defineRoute({
    method: 'POST',
    path: '/societies/:societyId/invitations',
    summary: 'Invite a person to a flat. Share the code on WhatsApp.',
    permission: 'member.manage',
    params: SocietyParamsSchema,
    body: z
      .object({
        inviteeName: DisplayNameSchema,
        phone: PhoneSchema.optional(),
        email: EmailSchema.optional(),
        flatId: IdSchema.nullable().optional(),
        roleId: IdSchema.optional(),
        relation: OccupancyRelationSchema.default('OWNER'),
        expiresInDays: z.number().int().min(1).max(90).default(30),
      })
      .strict(),
    response: InvitationSchema,
  }),
  revokeInvitation: defineRoute({
    method: 'DELETE',
    path: '/societies/:societyId/invitations/:invitationId',
    summary: 'Revoke an invitation',
    permission: 'member.manage',
    params: SocietyParamsSchema.extend({ invitationId: IdSchema }),
    response: OkSchema,
  }),
};
