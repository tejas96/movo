import { societyKey } from '../../core/api/query-keys';

export const parkingKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    all: [...root, 'parking'] as const,
    mine: [...root, 'parking', 'me'] as const,
    slots: (filter: string) => [...root, 'parking', 'slots', filter] as const,
    vehicles: (q: string) => [...root, 'parking', 'vehicles', q] as const,
  };
};
