import { type Meeting, meetingsContract, type RouteBody, type Timeframe } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { useCursorList } from '../../core/api/use-cursor-list';
import { meetingsKeys } from './keys';

type CreateBody = RouteBody<typeof meetingsContract.create>;
type UpdateBody = RouteBody<typeof meetingsContract.update>;

export function useMeetings(societyId: string, when: Timeframe) {
  return useCursorList({
    queryKey: meetingsKeys(societyId).list(when),
    fetchPage: (cursor) =>
      api(meetingsContract.list, {
        params: { societyId },
        query: { when, cursor, limit: 20 },
      }),
  });
}

export function useMeeting(societyId: string, meetingId: string) {
  return useQuery({
    queryKey: meetingsKeys(societyId).detail(meetingId),
    queryFn: () => api(meetingsContract.get, { params: { societyId, meetingId } }),
    enabled: Boolean(meetingId),
  });
}

function useInvalidateMeetings(societyId: string) {
  const qc = useQueryClient();
  return (meeting: Meeting) => {
    void qc.invalidateQueries({ queryKey: meetingsKeys(societyId).lists });
    qc.setQueryData(meetingsKeys(societyId).detail(meeting.id), meeting);
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
