import { type RouteBody, societyContract } from '@movo/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';

export function useBuildings(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).buildings,
    queryFn: () => api(societyContract.listBuildings, { params: { societyId } }),
  });
}

export function useFlats(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).flats,
    queryFn: () => api(societyContract.listFlats, { params: { societyId } }),
  });
}

export function useCreateBuilding(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.createBuilding>) =>
      api(societyContract.createBuilding, { params: { societyId }, body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.society(societyId).all }),
  });
}

export function useCreateFlats(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.createFlats>) =>
      api(societyContract.createFlats, { params: { societyId }, body }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.society(societyId).all }),
  });
}

export function useInvitations(societyId: string) {
  return useInfiniteQuery({
    queryKey: keys.society(societyId).invitations,
    queryFn: ({ pageParam }) =>
      api(societyContract.listInvitations, {
        params: { societyId },
        query: { cursor: pageParam, limit: 30 },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useCreateInvitation(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteBody<typeof societyContract.createInvitation>) =>
      api(societyContract.createInvitation, { params: { societyId }, body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.society(societyId).invitations });
      void qc.invalidateQueries({ queryKey: keys.society(societyId).home });
    },
  });
}

export function useRevokeInvitation(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      api(societyContract.revokeInvitation, { params: { societyId, invitationId } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.society(societyId).invitations }),
  });
}

export function useJoinRequests(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).joinRequests,
    queryFn: () =>
      api(societyContract.listJoinRequests, {
        params: { societyId },
        query: { status: 'PENDING' },
      }),
  });
}

export function useDecideJoinRequest(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      approve,
    }: {
      requestId: string;
      approve: boolean;
    }): Promise<unknown> =>
      approve
        ? api(societyContract.approveJoinRequest, { params: { societyId, requestId }, body: {} })
        : api(societyContract.rejectJoinRequest, { params: { societyId, requestId }, body: {} }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.society(societyId).joinRequests });
      void qc.invalidateQueries({ queryKey: keys.society(societyId).home });
      void qc.invalidateQueries({ queryKey: [...keys.society(societyId).all, 'members'] });
    },
  });
}

export function useRotateJoinCode(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api(societyContract.update, { params: { societyId }, body: { rotateJoinCode: true } }),
    onSuccess: (profile) => qc.setQueryData(keys.society(societyId).profile, profile),
  });
}
