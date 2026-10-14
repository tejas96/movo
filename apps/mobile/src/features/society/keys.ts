import { societyKey } from '../../core/api/query-keys';

export const societyKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    profile: [...root, 'profile'] as const,
  };
};
