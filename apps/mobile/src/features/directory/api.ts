import { type RouteBody, societyContract } from '@movo/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';
import { invalidateContext } from '../../core/auth/auth';

export function useMembers(societyId: string, q: string) {
  return useInfiniteQuery({
    queryKey: keys.society(societyId).members(q),
    queryFn: ({ pageParam }) =>
      api(societyContract.listMembers, {
        params: { societyId },
        query: { q: q || undefined, cursor: pageParam, limit: 30 },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 60_000,
  });
}

export function useMember(societyId: string, membershipId: string) {
  return useQuery({
    queryKey: keys.society(societyId).member(membershipId),
    queryFn: () => api(societyContract.getMember, { params: { societyId, membershipId } }),
  });
}

export function useRoles(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).roles,
    queryFn: () => api(societyContract.listRoles, { params: { societyId } }),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateMember(societyId: string, membershipId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.updateMember>) =>
      api(societyContract.updateMember, { params: { societyId, membershipId }, body }),
    onSuccess: (card) => {
      qc.setQueryData(keys.society(societyId).member(membershipId), card);
      void qc.invalidateQueries({ queryKey: [...keys.society(societyId).all, 'members'] });
      void invalidateContext();
    },
  });
}

export function useIssueResetCode(societyId: string, membershipId: string) {
  return useMutation({
    mutationFn: () => api(societyContract.issueResetCode, { params: { societyId, membershipId } }),
  });
}
