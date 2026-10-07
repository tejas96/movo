import { z } from 'zod';
import { UserSchema } from '../auth/auth.contract';
import {
  CursorQuerySchema,
  DisplayNameSchema,
  IdSchema,
  IsoDateTimeSchema,
  LocaleSchema,
  OkSchema,
  PasswordSchema,
  page,
} from '../core/common';
import {
  DevicePlatformSchema,
  JoinRequestStatusSchema,
  MembershipStatusSchema,
  ModuleKeySchema,
  NotificationCategorySchema,
  OccupancyRelationSchema,
  PermissionKeySchema,
} from '../core/enums';
import { defineRoute } from '../core/route';
import { AVATAR_UPLOAD_PATH } from '../files/files.contract';
import { SocietySettingsSchema } from '../settings';

export const SocietySummarySchema = z.object({
  id: IdSchema,
  name: z.string(),
  slug: z.string(),
  city: z.string().nullable(),
  logoUrl: z.string().nullable(),
  defaultLocale: LocaleSchema,
  timezone: z.string(),
});
export type SocietySummary = z.infer<typeof SocietySummarySchema>;

export const RoleSummarySchema = z.object({
  id: IdSchema,
  key: z.string(),
  name: z.string(),
});

export const MemberFlatSchema = z.object({
  id: IdSchema,
  number: z.string(),
  buildingId: IdSchema.nullable(),
  buildingName: z.string().nullable(),
  relation: OccupancyRelationSchema,
  isPrimaryContact: z.boolean(),
});
export type MemberFlat = z.infer<typeof MemberFlatSchema>;

export const ModuleStateSchema = z.object({
  key: ModuleKeySchema,
  enabled: z.boolean(),
  settings: z.record(z.string(), z.unknown()),
});
export type ModuleState = z.infer<typeof ModuleStateSchema>;

export const MembershipContextSchema = z.object({
  id: IdSchema,
  status: MembershipStatusSchema,
  society: SocietySummarySchema,
  societySettings: SocietySettingsSchema,
  roles: z.array(RoleSummarySchema),
  permissions: z.array(PermissionKeySchema),
  flats: z.array(MemberFlatSchema),
  modules: z.array(ModuleStateSchema),
  joinedAt: IsoDateTimeSchema.nullable(),
});
export type MembershipContext = z.infer<typeof MembershipContextSchema>;

export const PendingJoinRequestSchema = z.object({
  id: IdSchema,
  society: SocietySummarySchema,
  flatNumber: z.string(),
  buildingName: z.string().nullable(),
  status: JoinRequestStatusSchema,
  createdAt: IsoDateTimeSchema,
});
export type PendingJoinRequest = z.infer<typeof PendingJoinRequestSchema>;

export const MeContextSchema = z.object({
  user: UserSchema,
  memberships: z.array(MembershipContextSchema),
  pendingJoinRequests: z.array(PendingJoinRequestSchema),
  isPlatformAdmin: z.boolean(),
});
export type MeContext = z.infer<typeof MeContextSchema>;

export const NotificationSchema = z.object({
  id: IdSchema,
  societyId: IdSchema.nullable(),
  category: NotificationCategorySchema,
  title: z.string(),
  body: z.string(),
  data: z.record(z.string(), z.unknown()),
  readAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type Notification = z.infer<typeof NotificationSchema>;

export const meContract = {
  get: defineRoute({
    method: 'GET',
    path: '/v1/me',
    summary: 'My profile',
    response: UserSchema,
  }),
  update: defineRoute({
    method: 'PATCH',
    path: '/v1/me',
    summary: 'Update my name or language',
    body: z
      .object({ displayName: DisplayNameSchema.optional(), locale: LocaleSchema.optional() })
      .strict(),
    response: UserSchema,
  }),
  setAvatar: defineRoute({
    method: 'POST',
    path: AVATAR_UPLOAD_PATH,
    summary:
      'Set my profile photo: multipart/form-data with one field "file" (JPEG, PNG or WebP, 5 MB at most). Replaces the old one.',
    response: UserSchema,
  }),
  removeAvatar: defineRoute({
    method: 'DELETE',
    path: AVATAR_UPLOAD_PATH,
    summary: 'Remove my profile photo',
    response: UserSchema,
  }),
  context: defineRoute({
    method: 'GET',
    path: '/v1/me/context',
    summary:
      'Everything the app needs to build navigation: memberships, roles, permissions, flats, modules',
    response: MeContextSchema,
  }),
  deleteAccount: defineRoute({
    method: 'DELETE',
    path: '/v1/me',
    summary: 'Delete my account. Personal data is anonymised. Required by Google Play.',
    body: z.object({ password: PasswordSchema }).strict(),
    response: OkSchema,
  }),
  registerDevice: defineRoute({
    method: 'POST',
    path: '/v1/me/devices',
    summary: 'Register a push token for this device',
    body: z
      .object({
        token: z.string().min(10).max(4096),
        platform: DevicePlatformSchema,
        appVersion: z.string().max(40).optional(),
      })
      .strict(),
    response: OkSchema,
  }),
  removeDevice: defineRoute({
    method: 'DELETE',
    path: '/v1/me/devices',
    summary: 'Remove a push token',
    body: z.object({ token: z.string().min(10).max(4096) }).strict(),
    response: OkSchema,
  }),
  notifications: defineRoute({
    method: 'GET',
    path: '/v1/me/notifications',
    summary: 'My notification center, newest first',
    query: CursorQuerySchema,
    response: page(NotificationSchema).extend({ unreadCount: z.number().int() }),
  }),
  markNotificationRead: defineRoute({
    method: 'POST',
    path: '/v1/me/notifications/:notificationId/read',
    summary: 'Mark one notification read',
    params: z.object({ notificationId: IdSchema }),
    response: OkSchema,
  }),
  markAllNotificationsRead: defineRoute({
    method: 'POST',
    path: '/v1/me/notifications/read-all',
    summary: 'Mark every notification read',
    response: OkSchema,
  }),
};

/** Joining a society: by invite code, or by join code plus a flat that the admin approves. */
export const JoinSocietyPreviewSchema = z.object({
  society: SocietySummarySchema,
  joinRequestsEnabled: z.boolean(),
  buildings: z.array(z.object({ id: IdSchema, name: z.string() })),
  flats: z.array(
    z.object({
      id: IdSchema,
      number: z.string(),
      buildingId: IdSchema.nullable(),
      floor: z.number().int().nullable(),
    }),
  ),
});
export type JoinSocietyPreview = z.infer<typeof JoinSocietyPreviewSchema>;

export const joinContract = {
  acceptInvite: defineRoute({
    method: 'POST',
    path: '/v1/join/invite',
    summary: 'Join a society with an invite code. The membership becomes active at once.',
    body: z.object({ code: z.string().trim().min(6).max(16) }).strict(),
    response: z.object({ membershipId: IdSchema, society: SocietySummarySchema }),
  }),
  preview: defineRoute({
    method: 'GET',
    path: '/v1/join/societies/:joinCode',
    summary: 'Look up a society by its join code and list its flats',
    params: z.object({ joinCode: z.string().trim().min(4).max(16) }),
    response: JoinSocietyPreviewSchema,
  }),
  request: defineRoute({
    method: 'POST',
    path: '/v1/join/request',
    summary: 'Ask to join a society as the occupant of a flat. An admin approves it.',
    body: z
      .object({
        joinCode: z.string().trim().min(4).max(16),
        flatId: IdSchema,
        relation: OccupancyRelationSchema,
        message: z.string().trim().max(300).optional(),
      })
      .strict(),
    response: PendingJoinRequestSchema,
  }),
  cancelRequest: defineRoute({
    method: 'DELETE',
    path: '/v1/join/request/:requestId',
    summary: 'Withdraw my pending join request',
    params: z.object({ requestId: IdSchema }),
    response: OkSchema,
  }),
};
