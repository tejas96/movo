import { eventsContract, type RouteBody, type SocietyEvent, type Timeframe } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { useCursorList } from '../../core/api/use-cursor-list';
import { eventsKeys } from './keys';

type CreateBody = RouteBody<typeof eventsContract.create>;
type UpdateBody = RouteBody<typeof eventsContract.update>;
type RsvpBody = RouteBody<typeof eventsContract.rsvp>;

export function useEvents(societyId: string, when: Timeframe) {
  return useCursorList({
    queryKey: eventsKeys(societyId).list(when),
    fetchPage: (cursor) =>
      api(eventsContract.list, {
        params: { societyId },
        query: { when, cursor, limit: 20 },
      }),
  });
}

export function useEvent(societyId: string, eventId: string) {
  return useQuery({
    queryKey: eventsKeys(societyId).detail(eventId),
    queryFn: () => api(eventsContract.get, { params: { societyId, eventId } }),
    enabled: Boolean(eventId),
  });
}

export function useEventRsvps(societyId: string, eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: eventsKeys(societyId).rsvps(eventId),
    queryFn: () => api(eventsContract.listRsvps, { params: { societyId, eventId } }),
    enabled,
  });
}

function useInvalidateEvents(societyId: string) {
  const qc = useQueryClient();
  return (event: SocietyEvent) => {
    void qc.invalidateQueries({ queryKey: eventsKeys(societyId).lists });
    void qc.invalidateQueries({ queryKey: eventsKeys(societyId).rsvps(event.id) });
    qc.setQueryData(eventsKeys(societyId).detail(event.id), event);
  };
}

export function useCreateEvent(societyId: string) {
  const invalidate = useInvalidateEvents(societyId);
  return useMutation({
    mutationFn: (body: CreateBody) => api(eventsContract.create, { params: { societyId }, body }),
    onSuccess: invalidate,
  });
}

export function useUpdateEvent(societyId: string, eventId: string) {
  const invalidate = useInvalidateEvents(societyId);
  return useMutation({
    mutationFn: (body: UpdateBody) =>
      api(eventsContract.update, { params: { societyId, eventId }, body }),
    onSuccess: invalidate,
  });
}

export function useCancelEvent(societyId: string, eventId: string) {
  const invalidate = useInvalidateEvents(societyId);
  return useMutation({
    mutationFn: (reason?: string) =>
      api(eventsContract.cancel, {
        params: { societyId, eventId },
        body: reason ? { reason } : {},
      }),
    onSuccess: invalidate,
  });
}

export function useRsvp(societyId: string, eventId: string) {
  const invalidate = useInvalidateEvents(societyId);
  return useMutation({
    mutationFn: (body: RsvpBody) =>
      api(eventsContract.rsvp, { params: { societyId, eventId }, body }),
    onSuccess: invalidate,
  });
}
