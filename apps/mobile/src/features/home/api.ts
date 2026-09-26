import { homeContract, meContract } from '@movo/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';

export function useHomeSummary(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).home,
    queryFn: () => api(homeContract.summary, { params: { societyId } }),
    staleTime: 15_000,
  });
}

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: keys.me.notifications,
    queryFn: ({ pageParam }) =>
      api(meContract.notifications, { query: { cursor: pageParam, limit: 20 } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(meContract.markAllNotificationsRead),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.me.notifications });
      void qc.invalidateQueries({ queryKey: ['society'] });
    },
  });
}
