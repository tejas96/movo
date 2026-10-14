import { societyKey } from '../../core/api/query-keys';

export const eventsKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    all: [...root, 'events'] as const,
    lists: [...root, 'events', 'list'] as const,
    list: (when: string) => [...root, 'events', 'list', when] as const,
    detail: (eventId: string) => [...root, 'events', 'one', eventId] as const,
    rsvps: (eventId: string) => [...root, 'events', 'rsvps', eventId] as const,
  };
};
