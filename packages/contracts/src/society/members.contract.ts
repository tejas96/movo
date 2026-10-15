import { z } from 'zod';
import {
  CursorQuerySchema,
  EmailSchema,
  IdSchema,
  IsoDateTimeSchema,
  OkSchema,
  PhoneSchema,
  page,
  SocietyParamsSchema,
} from '../core/common';
import { MembershipStatusSchema, OccupancyRelationSchema } from '../core/enums';
import { defineRoute } from '../core/route';
import { MemberFlatSchema, RoleSummarySchema } from '../me/me.contract';
import { VehicleSchema } from '../parking/parking.contract';

export const MemberCardSchema = z.object({
  membershipId: IdSchema,
  userId: IdSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  status: MembershipStatusSchema,
  roles: z.array(RoleSummarySchema),
  flats: z.array(MemberFlatSchema),
  /** null when hidden by privacy. */
  phone: PhoneSchema.nullable(),
  email: EmailSchema.nullable(),
  isStaff: z.boolean(),
  joinedAt: IsoDateTimeSchema.nullable(),
});
export type MemberCard = z.infer<typeof MemberCardSchema>;

export const MemberDetailSchema = MemberCardSchema.extend({
  /** null when the society's directory.showVehicles setting hides them from this viewer. */
  vehicles: z.array(VehicleSchema).nullable(),
  /** Roles, flats, suspend, remove, reset code: member.manage and not the viewer. */
  canManage: z.boolean(),
});
export type MemberDetail = z.infer<typeof MemberDetailSchema>;

/** Member directory, member admin and my privacy in a society. Part of societyContract. */
export const societyMemberRoutes = {
  listMembers: defineRoute({
    method: 'GET',
    path: '/societies/:societyId/members',
    summary: 'Member directory. Privacy is applied by the server.',
    module: 'directory',
    params: SocietyParamsSchema,
    query: CursorQuerySchema.extend({
      q: z.string().trim().max(60).optional(),
      buildingId: IdSchema.optional(),
      status: MembershipStatusSchema.optional(),
    }),
    response: page(MemberCardSchema),
  }),
  getMember: defineRoute({
    method: 'GET',
    path: '/societies/:societyId/members/:membershipId',
    summary: 'One member, with vehicles when the society shows them',
    module: 'directory',
    params: SocietyParamsSchema.extend({ membershipId: IdSchema }),
    response: MemberDetailSchema,
  }),
  updateMember: defineRoute({
    method: 'PATCH',
    path: '/societies/:societyId/members/:membershipId',
    summary: 'Change roles or status of a member',
    permission: 'member.manage',
    params: SocietyParamsSchema.extend({ membershipId: IdSchema }),
    body: z
      .object({
        roleIds: z.array(IdSchema).min(1).max(5).optional(),
        status: z.enum(['ACTIVE', 'SUSPENDED', 'LEFT']).optional(),
      })
      .strict(),
    response: MemberCardSchema,
  }),
  setOccupancies: defineRoute({
    method: 'PUT',
    path: '/societies/:societyId/members/:membershipId/flats',
    summary: 'Replace the flats a member occupies',
    permission: 'member.manage',
    params: SocietyParamsSchema.extend({ membershipId: IdSchema }),
    body: z
      .object({
        flats: z
          .array(
            z.object({
              flatId: IdSchema,
              relation: OccupancyRelationSchema,
              isPrimaryContact: z.boolean().default(false),
            }),
          )
          .max(10),
      })
      .strict(),
    response: MemberCardSchema,
  }),
  issueResetCode: defineRoute({
    method: 'POST',
    path: '/societies/:societyId/members/:membershipId/reset-code',
    summary: 'Issue a one-time password reset code for a member who has no email. Shown once.',
    permission: 'member.manage',
    params: SocietyParamsSchema.extend({ membershipId: IdSchema }),
    response: z.object({ code: z.string(), expiresAt: IsoDateTimeSchema }),
  }),
  leaveSociety: defineRoute({
    method: 'POST',
    path: '/societies/:societyId/members/me/leave',
    summary:
      'Leave this society. Ends my flats here and hands back my tasks, duty turns and market ' +
      'items. The last admin cannot leave (LAST_ADMIN).',
    params: SocietyParamsSchema,
    response: OkSchema,
  }),
  getMyPrivacy: defineRoute({
    method: 'GET',
    path: '/societies/:societyId/members/me/privacy',
    summary:
      'What other members may see about me in this society, and whether showing my phone is allowed',
    params: SocietyParamsSchema,
    response: z.object({
      showPhone: z.boolean(),
      showEmail: z.boolean(),
      /** false when the society's directory.allowPhoneOptIn setting is off. */
      phoneOptInAllowed: z.boolean(),
    }),
  }),
  updateMyPrivacy: defineRoute({
    method: 'PATCH',
    path: '/societies/:societyId/members/me/privacy',
    summary: 'What other members may see about me in this society',
    params: SocietyParamsSchema,
    body: z
      .object({ showPhone: z.boolean().optional(), showEmail: z.boolean().optional() })
      .strict(),
    response: z.object({ showPhone: z.boolean(), showEmail: z.boolean() }),
  }),
};
