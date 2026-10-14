import type { QueryKey } from '@tanstack/react-query';
import { meKey, societyKey } from '../../core/api/query-keys';

export const homeKeys = (societyId: string) => ({
  all: [...societyKey(societyId), 'home'] as const,
});

/** Matches the home summary of any society (it carries the unread badge). */
export function isHomeKey(key: QueryKey): boolean {
  return key[0] === 'society' && key[2] === 'home';
}

export const notificationKeys = {
  all: [...meKey, 'notifications'] as const,
};
