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

export function can(ctx: TenantContext, permission: PermissionKey): boolean {
  return ctx.permissions.has(permission);
}
