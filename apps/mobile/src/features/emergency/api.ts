import { emergencyContract, type RouteBody } from '@movo/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';

export function useEmergencyContacts(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).emergencyContacts,
    queryFn: () => api(emergencyContract.listContacts, { params: { societyId } }),
    staleTime: 5 * 60_000,
  });
}

export function useAlerts(societyId: string, status: 'ACTIVE' | 'CLOSED') {
  return useInfiniteQuery({
    queryKey: keys.society(societyId).alerts(status),
    queryFn: ({ pageParam }) =>
      api(emergencyContract.listAlerts, {
        params: { societyId },
        query: { status, cursor: pageParam, limit: 20 },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Active alerts change fast; keep them fresh while the screen is open.
    refetchInterval: status === 'ACTIVE' ? 20_000 : false,
  });
}

export function useAlert(societyId: string, alertId: string) {
  return useQuery({
    queryKey: keys.society(societyId).alert(alertId),
    queryFn: () => api(emergencyContract.getAlert, { params: { societyId, alertId } }),
  });
}

function useInvalidateEmergency(societyId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [...keys.society(societyId).all, 'emergency'] });
    void qc.invalidateQueries({ queryKey: keys.society(societyId).home });
  };
}

export function useRaiseAlert(societyId: string) {
  const invalidate = useInvalidateEmergency(societyId);
  return useMutation({
    mutationFn: (body: RouteBody<typeof emergencyContract.raiseAlert>) =>
      api(emergencyContract.raiseAlert, { params: { societyId }, body }),
    onSuccess: invalidate,
  });
}

export function useResolveAlert(societyId: string, alertId: string) {
  const invalidate = useInvalidateEmergency(societyId);
  return useMutation({
    mutationFn: (body: RouteBody<typeof emergencyContract.resolveAlert>) =>
      api(emergencyContract.resolveAlert, { params: { societyId, alertId }, body }),
    onSuccess: invalidate,
  });
}

export function useSaveContact(societyId: string) {
  const invalidate = useInvalidateEmergency(societyId);
  return useMutation({
    mutationFn: ({
      contactId,
      body,
    }: {
      contactId?: string;
      body: RouteBody<typeof emergencyContract.createContact>;
    }) =>
      contactId
        ? api(emergencyContract.updateContact, { params: { societyId, contactId }, body })
        : api(emergencyContract.createContact, { params: { societyId }, body }),
    onSuccess: invalidate,
  });
}

export function useDeleteContact(societyId: string) {
  const invalidate = useInvalidateEmergency(societyId);
  return useMutation({
    mutationFn: (contactId: string) =>
      api(emergencyContract.deleteContact, { params: { societyId, contactId } }),
    onSuccess: invalidate,
  });
}
