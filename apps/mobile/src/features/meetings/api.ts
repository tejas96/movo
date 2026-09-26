import { type Meeting, meetingsContract, type RouteBody, type Timeframe } from '@movo/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';

type CreateBody = RouteBody<typeof meetingsContract.create>;
type UpdateBody = RouteBody<typeof meetingsContract.update>;

export function useMeetings(societyId: string, when: Timeframe) {
  return useInfiniteQuery({
    queryKey: keys.society(societyId).meetings(when),
    queryFn: ({ pageParam }) =>
      api(meetingsContract.list, {
        params: { societyId },
        query: { when, cursor: pageParam, limit: 20 },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useMeeting(societyId: string, meetingId: string) {
  return useQuery({
    queryKey: keys.society(societyId).meeting(meetingId),
    queryFn: () => api(meetingsContract.get, { params: { societyId, meetingId } }),
    enabled: Boolean(meetingId),
  });
}

function useInvalidateMeetings(societyId: string) {
  const qc = useQueryClient();
  return (meeting: Meeting) => {
    void qc.invalidateQueries({ queryKey: [...keys.society(societyId).all, 'meetings', 'list'] });
    void qc.invalidateQueries({ queryKey: keys.society(societyId).home });
    qc.setQueryData(keys.society(societyId).meeting(meeting.id), meeting);
  };
}

export function useCreateMeeting(societyId: string) {
  const invalidate = useInvalidateMeetings(societyId);
  return useMutation({
    mutationFn: (body: CreateBody) => api(meetingsContract.create, { params: { societyId }, body }),
    onSuccess: invalidate,
  });
}

export function useUpdateMeeting(societyId: string, meetingId: string) {
  const invalidate = useInvalidateMeetings(societyId);
  return useMutation({
    mutationFn: (body: UpdateBody) =>
      api(meetingsContract.update, { params: { societyId, meetingId }, body }),
    onSuccess: invalidate,
  });
}

export type MeetingAction = 'note' | 'cancel' | 'complete';

export function useMeetingAction(societyId: string, meetingId: string) {
  const invalidate = useInvalidateMeetings(societyId);
  return useMutation({
    mutationFn: ({ action, note }: { action: MeetingAction; note?: string }) => {
      const params = { societyId, meetingId };
      if (action === 'note')
        return api(meetingsContract.addNote, { params, body: { note: note ?? '' } });
      const body = note ? { note } : {};
      if (action === 'cancel') return api(meetingsContract.cancel, { params, body });
      return api(meetingsContract.complete, { params, body });
    },
    onSuccess: invalidate,
  });
}
