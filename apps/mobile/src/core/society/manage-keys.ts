import { societyKey } from '../api/query-keys';

export const manageKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    roles: [...root, 'roles'] as const,
    modules: [...root, 'modules'] as const,
    audit: (area: string) => [...root, 'audit', area] as const,
    buildings: [...root, 'buildings'] as const,
    flats: [...root, 'flats'] as const,
    invitations: [...root, 'invitations'] as const,
    joinRequests: [...root, 'join-requests'] as const,
  };
};
