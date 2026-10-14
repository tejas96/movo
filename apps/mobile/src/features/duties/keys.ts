import { societyKey } from '../../core/api/query-keys';

export const dutiesKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    all: [...root, 'duties'] as const,
    list: (mine: boolean) => [...root, 'duties', 'list', mine] as const,
    detail: (dutyId: string) => [...root, 'duties', 'one', dutyId] as const,
  };
};
