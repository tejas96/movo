import { societyKey } from '../../core/api/query-keys';

/** Lists (`notices`) and one notice (`notice`) are separate roots. */
export const noticesKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    lists: [...root, 'notices'] as const,
    list: (status: string) => [...root, 'notices', status] as const,
    detail: (noticeId: string) => [...root, 'notice', noticeId] as const,
  };
};
