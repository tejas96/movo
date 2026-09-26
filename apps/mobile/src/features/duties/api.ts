import { dutiesContract, type RouteBody } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';

const c = dutiesContract;

export function useDuties(societyId: string, mine: boolean) {
  return useQuery({
    queryKey: keys.society(societyId).dutyList(mine),
    queryFn: () => api(c.list, { params: { societyId }, query: { mine: mine ? 'true' : 'false' } }),
  });
}

export function useDuty(societyId: string, dutyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).duty(dutyId),
    queryFn: () => api(c.get, { params: { societyId, dutyId } }),
  });
}

/** Duty changes move Home and points too. */
function useInvalidate(societyId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: keys.society(societyId).duties });
    void qc.invalidateQueries({ queryKey: keys.society(societyId).home });
    void qc.invalidateQueries({ queryKey: keys.society(societyId).rewards });
  };
}

export function useCreateDuty(societyId: string) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: (body: RouteBody<typeof c.create>) =>
      api(c.create, { params: { societyId }, body }),
    onSuccess: invalidate,
  });
}

export function useDutyAction(societyId: string, dutyId: string) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: (
      a:
        | { kind: 'confirm'; assignmentId: string }
        | { kind: 'status'; status: 'ACTIVE' | 'PAUSED' | 'ENDED' }
        | { kind: 'participants'; participantIds: string[] }
        | {
            kind: 'override';
            assignmentId: string;
            body: RouteBody<typeof c.override>;
          },
    ) => {
      const params = { societyId, dutyId };
      if (a.kind === 'confirm')
        return api(c.confirm, { params: { ...params, assignmentId: a.assignmentId } });
      if (a.kind === 'status') return api(c.setStatus, { params, body: { status: a.status } });
      if (a.kind === 'participants')
        return api(c.setParticipants, { params, body: { participantIds: a.participantIds } });
      return api(c.override, { params: { ...params, assignmentId: a.assignmentId }, body: a.body });
    },
    onSuccess: invalidate,
  });
}
