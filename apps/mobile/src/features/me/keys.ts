import { societyKey } from '../../core/api/query-keys';

export const meKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    privacy: [...root, 'my-privacy'] as const,
  };
};
