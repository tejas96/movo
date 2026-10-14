import type { Locale } from '@movo/contracts';
import type { TenantLookup } from '../tenant/tenant.types';

/**
 * What the route guard needs from identity and tenancy. The app module wires the real
 * services in, so common/ does not import feature modules.
 */
export interface RouteAuth {
  isSessionLive(sessionId: string): Promise<boolean>;
  findActiveUser(userId: string): Promise<{ id: string; locale: Locale } | null>;
  lookupTenant(userId: string, societyId: string): Promise<TenantLookup>;
}

export const ROUTE_AUTH = Symbol('ROUTE_AUTH');
