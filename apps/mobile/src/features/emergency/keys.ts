import { societyKey } from '../../core/api/query-keys';

export const emergencyKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    all: [...root, 'emergency'] as const,
    contacts: [...root, 'emergency', 'contacts'] as const,
    list: (status: string) => [...root, 'emergency', 'alerts', status] as const,
    detail: (alertId: string) => [...root, 'emergency', 'alert', alertId] as const,
  };
};
