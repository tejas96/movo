import {
  type MeContext,
  type MemberFlat,
  type MembershipContext,
  type ModuleKey,
  meContract,
  type PermissionKey,
} from '@movo/contracts';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../api/client';
import { keys } from '../api/keys';
import { useSessionStore } from '../auth/session.store';
import { useTenantStore } from './tenant.store';

export function useMeContext(enabled = true) {
  const status = useSessionStore((s) => s.status);
  return useQuery<MeContext>({
    queryKey: keys.me.context,
    queryFn: () => api(meContract.context),
    enabled: enabled && status === 'signedIn',
    staleTime: 60_000,
  });
}

/** The membership all tenant screens work in. Falls back to the first active one and remembers it. */
export function useActiveMembership(): MembershipContext | null {
  const { data } = useMeContext();
  const activeId = useTenantStore((s) => s.activeSocietyId);
  const setActive = useTenantStore((s) => s.setActiveSocietyId);
  const active = data?.memberships.filter((m) => m.status === 'ACTIVE') ?? [];
  const chosen = active.find((m) => m.society.id === activeId) ?? active[0] ?? null;
  useEffect(() => {
    if (chosen && chosen.society.id !== activeId) setActive(chosen.society.id);
  }, [chosen, activeId, setActive]);
  return chosen;
}

/** Only for screens rendered inside the main tabs, where a membership is guaranteed. */
export function useTenant(): MembershipContext {
  const m = useActiveMembership();
  if (!m) throw new Error('useTenant outside of a society context');
  return m;
}

export function useSocietyId(): string {
  return useTenant().society.id;
}

export function useCan(permission: PermissionKey): boolean {
  return useActiveMembership()?.permissions.includes(permission) ?? false;
}

export function useModuleEnabled(key: ModuleKey): boolean {
  return useActiveMembership()?.modules.find((m) => m.key === key)?.enabled ?? false;
}

export function formatFlat(flat: Pick<MemberFlat, 'number' | 'buildingName'>): string {
  return flat.buildingName ? `${flat.buildingName}-${flat.number}` : flat.number;
}
