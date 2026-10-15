import { type RouteBody, societyContract } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { invalidateContext } from '../../core/auth/auth';
import { directoryKeys } from '../../core/members/keys';
import { manageKeys } from '../../core/society/manage-keys';

export function useMember(societyId: string, membershipId: string) {
  return useQuery({
    queryKey: directoryKeys(societyId).detail(membershipId),
    queryFn: () => api(societyContract.getMember, { params: { societyId, membershipId } }),
  });
}

export function useUpdateMember(societyId: string, membershipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.updateMember>) =>
      api(societyContract.updateMember, { params: { societyId, membershipId }, body }),
    onSuccess: (card) => {
      qc.setQueryData(directoryKeys(societyId).detail(membershipId), card);
      void qc.invalidateQueries({ queryKey: directoryKeys(societyId).lists });
      void invalidateContext();
    },
  });
}

export function useIssueResetCode(societyId: string, membershipId: string) {
  return useMutation({
    mutationFn: () => api(societyContract.issueResetCode, { params: { societyId, membershipId } }),
  });
}

export function useSetOccupancies(societyId: string, membershipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.setOccupancies>) =>
      api(societyContract.setOccupancies, { params: { societyId, membershipId }, body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: directoryKeys(societyId).detail(membershipId) });
      void qc.invalidateQueries({ queryKey: directoryKeys(societyId).lists });
      void qc.invalidateQueries({ queryKey: manageKeys(societyId).flats });
      void invalidateContext();
    },
  });
}
