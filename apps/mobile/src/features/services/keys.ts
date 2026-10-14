import { societyKey } from '../../core/api/query-keys';

export const vendorKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    all: [...root, 'vendors'] as const,
    categories: [...root, 'vendors', 'categories'] as const,
    list: (filter: string) => [...root, 'vendors', 'list', filter] as const,
    detail: (vendorId: string) => [...root, 'vendors', 'one', vendorId] as const,
  };
};
