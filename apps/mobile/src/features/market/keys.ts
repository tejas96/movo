import { societyKey } from '../../core/api/query-keys';

export const marketKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    all: [...root, 'market'] as const,
    listings: (filter: string) => [...root, 'market', 'listings', filter] as const,
    listing: (listingId: string) => [...root, 'market', 'listing', listingId] as const,
    mine: [...root, 'market', 'mine'] as const,
    orders: (role: string) => [...root, 'market', 'orders', role] as const,
    order: (orderId: string) => [...root, 'market', 'order', orderId] as const,
    reports: [...root, 'market', 'reports'] as const,
  };
};
