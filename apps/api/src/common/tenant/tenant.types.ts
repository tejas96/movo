import type {
  Locale,
  ModuleKey,
  PermissionKey,
  SocietySettings,
  SocietySummary,
} from '@movo/contracts';

export interface TenantRole {
  id: string;
  key: string;
  name: string;
}

/** Everything a tenant route needs about the caller, loaded once per request. */
export interface TenantContext {
  societyId: string;
  membershipId: string;
  userId: string;
  society: SocietySummary & { fyStartMonth: number };
  societySettings: SocietySettings;
  roles: TenantRole[];
  permissions: ReadonlySet<PermissionKey>;
  enabledModules: ReadonlySet<ModuleKey>;
  moduleSettings: Partial<Record<ModuleKey, Record<string, unknown>>>;
  flatIds: string[];
  buildingIds: string[];
  roleIds: string[];
  userLocale: Locale;
}

export type TenantLookup =
  | { kind: 'none' }
  | { kind: 'inactive' }
  | { kind: 'ok'; ctx: TenantContext };

export function can(ctx: TenantContext, permission: PermissionKey): boolean {
  return ctx.permissions.has(permission);
}

/**
 * The caller passes the route's own permission check. Entity can* flags use this with the
 * contract route, so a flag reads the same permission the route guard enforces.
 */
export function mayCall(ctx: TenantContext, route: { permission: PermissionKey | null }): boolean {
  return route.permission === null || can(ctx, route.permission);
}
