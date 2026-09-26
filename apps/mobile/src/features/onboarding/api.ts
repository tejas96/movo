import { joinContract, type RouteBody } from '@movo/contracts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';
import { invalidateContext } from '../../core/auth/auth';

export function useJoinPreview(joinCode: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.join.preview(joinCode),
    queryFn: () => api(joinContract.preview, { params: { joinCode } }),
    enabled,
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (code: string) => api(joinContract.acceptInvite, { body: { code } }),
    onSuccess: () => invalidateContext(),
  });
}

export function useJoinRequest() {
  return useMutation({
    mutationFn: (body: RouteBody<typeof joinContract.request>) =>
      api(joinContract.request, { body }),
    onSuccess: () => invalidateContext(),
  });
}

export function useCancelJoinRequest() {
  return useMutation({
    mutationFn: (requestId: string) => api(joinContract.cancelRequest, { params: { requestId } }),
    onSuccess: () => invalidateContext(),
  });
}
