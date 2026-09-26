import { eventsContract, type RouteBody, type SocietyEvent, type Timeframe } from '@movo/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';

type CreateBody = RouteBody<typeof eventsContract.create>;
type UpdateBody = RouteBody<typeof eventsContract.update>;
type RsvpBody = RouteBody<typeof eventsContract.rsvp>;

export function useEvents(societyId: string, when: Timeframe) {
  return useInfiniteQuery({
    queryKey: keys.society(societyId).events(when),
    queryFn: ({ pageParam }) =>
      api(eventsContract.list, {
        params: { societyId },
        query: { when, cursor: pageParam, limit: 20 },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useEvent(societyId: string, eventId: string) {
  return useQuery({
    queryKey: keys.society(societyId).event(eventId),
    queryFn: () => api(eventsContract.get, { params: { societyId, eventId } }),
    enabled: Boolean(eventId),
  });
}

export function useEventRsvps(societyId: string, eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.society(societyId).eventRsvps(eventId),
    queryFn: () => api(eventsContract.listRsvps, { params: { societyId, eventId } }),
    enabled,
  });
}

function useInvalidateEvents(societyId: string) {
  const qc = useQueryClient();
  return (event: SocietyEvent) => {
    void qc.invalidateQueries({ queryKey: [...keys.society(societyId).all, 'events', 'list'] });
    void qc.invalidateQueries({ queryKey: keys.society(societyId).eventRsvps(event.id) });
    void qc.invalidateQueries({ queryKey: keys.society(societyId).home });
    qc.setQueryData(keys.society(societyId).event(event.id), event);
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
