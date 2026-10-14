import { homeContract, meContract } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { anySocietyKey } from '../../core/api/query-keys';
import { useCursorList } from '../../core/api/use-cursor-list';
import { homeKeys, notificationKeys } from './keys';

export function useHomeSummary(societyId: string) {
  return useQuery({
    queryKey: homeKeys(societyId).all,
    queryFn: () => api(homeContract.summary, { params: { societyId } }),
    staleTime: 15_000,
  });
}

export function useNotifications() {
  return useCursorList({
    queryKey: notificationKeys.all,
    fetchPage: (cursor) => api(meContract.notifications, { query: { cursor, limit: 20 } }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api(meContract.markAllNotificationsRead),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
      void qc.invalidateQueries({ queryKey: anySocietyKey });
    },
  });
}
