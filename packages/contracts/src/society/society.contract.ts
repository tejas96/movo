import { z } from 'zod';
import {
  CursorQuerySchema,
  DisplayNameSchema,
  EmailSchema,
  IdSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  OkSchema,
  PhoneSchema,
  page,
} from '../core/common';
import {
  FlatStatusSchema,
  InvitationStatusSchema,
  JoinRequestStatusSchema,
  MembershipStatusSchema,
  ModuleKeySchema,
  OccupancyRelationSchema,
  PermissionKeySchema,
} from '../core/enums';
import { defineRoute } from '../core/route';
import {
  MemberFlatSchema,
  ModuleStateSchema,
  RoleSummarySchema,
  SocietySummarySchema,
} from '../me/me.contract';
import { VehicleSchema } from '../parking/parking.contract';
import { SocietySettingsSchema } from '../settings';

const societyParams = z.object({ societyId: IdSchema });

export const SocietyProfileSchema = SocietySummarySchema.extend({
  state: z.string().nullable(),
  pincode: z.string().nullable(),
  addressLine: z.string().nullable(),
  fyStartMonth: z.number().int(),
  joinCode: z.string().nullable(),
  settings: SocietySettingsSchema,
  counts: z.object({
    buildings: z.number().int(),
    flats: z.number().int(),
    members: z.number().int(),
  }),
});

export const BuildingSchema = z.object({
  id: IdSchema,
  name: z.string(),
  floorsCount: z.number().int().nullable(),
  sortOrder: z.number().int(),
  flatCount: z.number().int(),
});
export type Building = z.infer<typeof BuildingSchema>;

export const FlatOccupantSchema = z.object({
  membershipId: IdSchema,
  displayName: z.string(),
  relation: OccupancyRelationSchema,
  isPrimaryContact: z.boolean(),
});

export const FlatSchema = z.object({
  id: IdSchema,
  buildingId: IdSchema.nullable(),
  buildingName: z.string().nullable(),
  number: z.string(),
  floor: z.number().int().nullable(),
  type: z.string().nullable(),
  areaSqft: z.number().int().nullable(),
  status: FlatStatusSchema,
  occupants: z.array(FlatOccupantSchema),
});
export type Flat = z.infer<typeof FlatSchema>;

const FlatInputSchema = z.object({
  buildingId: IdSchema.nullable().optional(),
  number: z.string().trim().min(1).max(20),
  floor: z.number().int().min(-5).max(200).nullable().optional(),
  type: z.string().trim().max(20).nullable().optional(),
  areaSqft: z.number().int().min(1).max(100000).nullable().optional(),
});

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
});
export type MemberDetail = z.infer<typeof MemberDetailSchema>;

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
});
export type Invitation = z.infer<typeof InvitationSchema>;

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
});
export type JoinRequest = z.infer<typeof JoinRequestSchema>;

export const RoleSchema = RoleSummarySchema.extend({
  isSystem: z.boolean(),
  permissions: z.array(PermissionKeySchema),
  memberCount: z.number().int(),
});
export type Role = z.infer<typeof RoleSchema>;
export type SocietyProfile = z.infer<typeof SocietyProfileSchema>;

export const societyContract = {
  get: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId',
    summary: 'Society profile and counts',
    params: societyParams,
    response: SocietyProfileSchema,
  }),
  update: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId',
    summary: 'Update the society profile or core settings',
    permission: 'society.settings.manage',
    params: societyParams,
    body: z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        city: z.string().trim().max(60).nullable().optional(),
        state: z.string().trim().max(60).nullable().optional(),
        pincode: z.string().trim().max(10).nullable().optional(),
        addressLine: z.string().trim().max(200).nullable().optional(),
        defaultLocale: LocaleSchema.optional(),
        fyStartMonth: z.number().int().min(1).max(12).optional(),
        settings: SocietySettingsSchema.partial().optional(),
        rotateJoinCode: z.boolean().optional(),
      })
      .strict(),
    response: SocietyProfileSchema,
  }),

  listBuildings: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/buildings',
    summary: 'Buildings or wings',
    params: societyParams,
    response: z.array(BuildingSchema),
  }),
  createBuilding: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/buildings',
    summary: 'Add a building or wing',
    permission: 'society.structure.manage',
    params: societyParams,
    body: z
      .object({
        name: z.string().trim().min(1).max(40),
        floorsCount: z.number().int().min(1).max(200).nullable().optional(),
      })
      .strict(),
    response: BuildingSchema,
  }),
  updateBuilding: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/buildings/:buildingId',
    summary: 'Rename or reorder a building',
    permission: 'society.structure.manage',
    params: societyParams.extend({ buildingId: IdSchema }),
    body: z
      .object({
        name: z.string().trim().min(1).max(40).optional(),
        floorsCount: z.number().int().min(1).max(200).nullable().optional(),
        sortOrder: z.number().int().optional(),
      })
      .strict(),
    response: BuildingSchema,
  }),

  listFlats: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/flats',
    summary: 'Flats with their occupants',
    params: societyParams,
    query: z.object({ buildingId: IdSchema.optional() }),
    response: z.array(FlatSchema),
  }),
  createFlats: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/flats',
    summary: 'Add one or many flats',
    permission: 'society.structure.manage',
    params: societyParams,
    body: z.object({ flats: z.array(FlatInputSchema).min(1).max(500) }).strict(),
    response: z.array(FlatSchema),
  }),
  updateFlat: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/flats/:flatId',
    summary: 'Edit a flat',
    permission: 'society.structure.manage',
    params: societyParams.extend({ flatId: IdSchema }),
    body: FlatInputSchema.partial().extend({ status: FlatStatusSchema.optional() }).strict(),
    response: FlatSchema,
  }),

  listMembers: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/members',
    summary: 'Member directory. Privacy is applied by the server.',
    module: 'directory',
    params: societyParams,
    query: CursorQuerySchema.extend({
      q: z.string().trim().max(60).optional(),
      buildingId: IdSchema.optional(),
      status: MembershipStatusSchema.optional(),
    }),
    response: page(MemberCardSchema),
  }),
  getMember: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/members/:membershipId',
    summary: 'One member, with vehicles when the society shows them',
    module: 'directory',
    params: societyParams.extend({ membershipId: IdSchema }),
    response: MemberDetailSchema,
  }),
  updateMember: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/members/:membershipId',
    summary: 'Change roles or status of a member',
    permission: 'member.manage',
    params: societyParams.extend({ membershipId: IdSchema }),
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
    path: '/v1/societies/:societyId/members/:membershipId/flats',
    summary: 'Replace the flats a member occupies',
    permission: 'member.manage',
    params: societyParams.extend({ membershipId: IdSchema }),
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
    path: '/v1/societies/:societyId/members/:membershipId/reset-code',
    summary: 'Issue a one-time password reset code for a member who has no email. Shown once.',
    permission: 'member.manage',
    params: societyParams.extend({ membershipId: IdSchema }),
    response: z.object({ code: z.string(), expiresAt: IsoDateTimeSchema }),
  }),
  updateMyPrivacy: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/members/me/privacy',
    summary: 'What other members may see about me in this society',
    params: societyParams,
    body: z
      .object({ showPhone: z.boolean().optional(), showEmail: z.boolean().optional() })
      .strict(),
    response: z.object({ showPhone: z.boolean(), showEmail: z.boolean() }),
  }),

  listRoles: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/roles',
    summary: 'Roles of this society',
    params: societyParams,
    response: z.array(RoleSchema),
  }),

  listInvitations: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/invitations',
    summary: 'Invitations, newest first',
    permission: 'member.manage',
    params: societyParams,
    query: CursorQuerySchema.extend({ status: InvitationStatusSchema.optional() }),
    response: page(InvitationSchema),
  }),
  createInvitation: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/invitations',
    summary: 'Invite a person to a flat. Share the code on WhatsApp.',
    permission: 'member.manage',
    params: societyParams,
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
    path: '/v1/societies/:societyId/invitations/:invitationId',
    summary: 'Revoke an invitation',
    permission: 'member.manage',
    params: societyParams.extend({ invitationId: IdSchema }),
    response: OkSchema,
  }),

  listJoinRequests: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/join-requests',
    summary: 'Join requests waiting for a decision',
    permission: 'member.manage',
    params: societyParams,
    query: z.object({ status: JoinRequestStatusSchema.default('PENDING') }),
    response: z.array(JoinRequestSchema),
  }),
  approveJoinRequest: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/join-requests/:requestId/approve',
    summary: 'Approve a join request. Creates the membership and the flat occupancy.',
    permission: 'member.manage',
    params: societyParams.extend({ requestId: IdSchema }),
    body: z
      .object({ roleId: IdSchema.optional(), relation: OccupancyRelationSchema.optional() })
      .strict(),
    response: MemberCardSchema,
  }),
  rejectJoinRequest: defineRoute({
    method: 'POST',
    path: '/v1/societies/:societyId/join-requests/:requestId/reject',
    summary: 'Reject a join request',
    permission: 'member.manage',
    params: societyParams.extend({ requestId: IdSchema }),
    body: z.object({ reason: z.string().trim().max(200).optional() }).strict(),
    response: OkSchema,
  }),

  listModules: defineRoute({
    method: 'GET',
    path: '/v1/societies/:societyId/modules',
    summary: 'Module switches and settings',
    permission: 'society.settings.manage',
    params: societyParams,
    response: z.array(ModuleStateSchema),
  }),
  updateModule: defineRoute({
    method: 'PATCH',
    path: '/v1/societies/:societyId/modules/:moduleKey',
    summary: 'Switch a module on or off, or change its settings',
    permission: 'society.settings.manage',
    params: societyParams.extend({ moduleKey: ModuleKeySchema }),
    body: z
      .object({
        enabled: z.boolean().optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
    response: ModuleStateSchema,
  }),
};
