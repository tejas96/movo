import { emergencyContract, type RouteBody } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { useCursorList } from '../../core/api/use-cursor-list';
import { emergencyKeys } from './keys';

export function useEmergencyContacts(societyId: string) {
  return useQuery({
    queryKey: emergencyKeys(societyId).contacts,
    queryFn: () => api(emergencyContract.listContacts, { params: { societyId } }),
    staleTime: 5 * 60_000,
  });
}

export function useAlerts(societyId: string, status: 'ACTIVE' | 'CLOSED') {
  return useCursorList({
    queryKey: emergencyKeys(societyId).list(status),
    fetchPage: (cursor) =>
      api(emergencyContract.listAlerts, {
        params: { societyId },
        query: { status, cursor, limit: 20 },
      }),
    // Active alerts change fast; keep them fresh while the screen is open.
    refetchInterval: status === 'ACTIVE' ? 20_000 : false,
  });
}

export function useAlert(societyId: string, alertId: string) {
  return useQuery({
    queryKey: emergencyKeys(societyId).detail(alertId),
    queryFn: () => api(emergencyContract.getAlert, { params: { societyId, alertId } }),
  });
}

function useInvalidateEmergency(societyId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: emergencyKeys(societyId).all });
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
