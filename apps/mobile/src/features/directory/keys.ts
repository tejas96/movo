import { societyKey } from '../../core/api/query-keys';

/** Member lists (`members`) and member cards (`member`) are separate roots. */
export const directoryKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    lists: [...root, 'members'] as const,
    list: (filter: string) => [...root, 'members', filter] as const,
    details: [...root, 'member'] as const,
    detail: (membershipId: string) => [...root, 'member', membershipId] as const,
  };
};
