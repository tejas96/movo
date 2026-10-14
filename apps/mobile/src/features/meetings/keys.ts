import { societyKey } from '../../core/api/query-keys';

export const meetingsKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    all: [...root, 'meetings'] as const,
    lists: [...root, 'meetings', 'list'] as const,
    list: (when: string) => [...root, 'meetings', 'list', when] as const,
    detail: (meetingId: string) => [...root, 'meetings', 'one', meetingId] as const,
  };
};
