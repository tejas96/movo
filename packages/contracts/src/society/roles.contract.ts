import { z } from 'zod';
import { IdSchema, OkSchema, SocietyParamsSchema } from '../core/common';
import { PermissionKeySchema } from '../core/enums';
import { defineRoute } from '../core/route';
import { RoleSummarySchema } from '../me/me.contract';

export const RoleSchema = RoleSummarySchema.extend({
  isSystem: z.boolean(),
  permissions: z.array(PermissionKeySchema),
  memberCount: z.number().int(),
  /** society.roles.manage; the admin role always keeps every permission. */
  canEditPermissions: z.boolean(),
  /** society.roles.manage and a role the society added (not built in). */
  canDelete: z.boolean(),
});
export type Role = z.infer<typeof RoleSchema>;

const RoleInputSchema = z.object({
  name: z.string().trim().min(2).max(40),
  permissions: z.array(PermissionKeySchema).max(100),
});

/** Roles and their permissions. Part of societyContract. */
export const societyRoleRoutes = {
  listRoles: defineRoute({
    method: 'GET',
    path: '/societies/:societyId/roles',
    summary: 'Roles of this society',
    params: SocietyParamsSchema,
    response: z.array(RoleSchema),
  }),
  createRole: defineRoute({
    method: 'POST',
    path: '/societies/:societyId/roles',
    summary: 'Add a role. You can only give permissions you hold yourself.',
    permission: 'society.roles.manage',
    params: SocietyParamsSchema,
    body: RoleInputSchema.strict(),
    response: RoleSchema,
  }),
  updateRole: defineRoute({
    method: 'PATCH',
    path: '/societies/:societyId/roles/:roleId',
    summary: 'Rename a role or change its permissions. The admin role keeps every permission.',
    permission: 'society.roles.manage',
    params: SocietyParamsSchema.extend({ roleId: IdSchema }),
    body: RoleInputSchema.partial().strict(),
    response: RoleSchema,
  }),
  deleteRole: defineRoute({
    method: 'DELETE',
    path: '/societies/:societyId/roles/:roleId',
    summary: 'Delete a role you added. It must have no members or invitations.',
    permission: 'society.roles.manage',
    params: SocietyParamsSchema.extend({ roleId: IdSchema }),
    response: OkSchema,
  }),
};
