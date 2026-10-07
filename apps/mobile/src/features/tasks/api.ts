import { type RouteBody, type TaskView, tasksContract } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';

const c = tasksContract;

export function useTasks(societyId: string, view: TaskView) {
  return useQuery({
    queryKey: keys.society(societyId).taskList(view),
    queryFn: () => api(c.list, { params: { societyId }, query: { view } }),
  });
}

export function useTask(societyId: string, taskId: string) {
  return useQuery({
    queryKey: keys.society(societyId).task(taskId),
    queryFn: () => api(c.get, { params: { societyId, taskId } }),
    enabled: Boolean(taskId),
  });
}

function useInvalidate(societyId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: keys.society(societyId).tasks });
    void qc.invalidateQueries({ queryKey: keys.society(societyId).home });
    void qc.invalidateQueries({ queryKey: keys.society(societyId).rewards });
  };
}

export function useSaveTask(societyId: string, taskId: string | undefined) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: (body: RouteBody<typeof c.create>) => {
      if (!taskId) return api(c.create, { params: { societyId }, body });
      const { assigneeMembershipId: _a, ...patch } = body;
      return api(c.update, { params: { societyId, taskId }, body: patch });
    },
    onSuccess: invalidate,
  });
}

export type TaskAction =
  | { kind: 'volunteer' | 'withdraw' | 'verify' | 'cancel' }
  | { kind: 'submit'; note?: string; proofIds: string[] }
  | { kind: 'sendBack'; reason: string }
  | { kind: 'assign'; membershipId: string | null };

export function useTaskAction(societyId: string, taskId: string) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: (a: TaskAction) => {
      const params = { societyId, taskId };
      switch (a.kind) {
        case 'volunteer':
          return api(c.volunteer, { params });
        case 'withdraw':
          return api(c.withdraw, { params });
        case 'verify':
          return api(c.verify, { params });
        case 'cancel':
          return api(c.cancel, { params });
        case 'submit':
          return api(c.submit, {
            params,
            body: { ...(a.note ? { note: a.note } : {}), proofIds: a.proofIds },
          });
        case 'sendBack':
          return api(c.sendBack, { params, body: { reason: a.reason } });
        case 'assign':
          return api(c.assign, { params, body: { membershipId: a.membershipId } });
      }
    },
    onSuccess: invalidate,
  });
}
