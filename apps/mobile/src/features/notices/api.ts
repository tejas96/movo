import {
  type Notice,
  type NoticeStatusSchema,
  noticesContract,
  type RouteBody,
} from '@movo/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';

type Status = z.infer<typeof NoticeStatusSchema>;
type CreateBody = RouteBody<typeof noticesContract.create>;
type UpdateBody = RouteBody<typeof noticesContract.update>;

export function useNotices(societyId: string, status: Status) {
  return useInfiniteQuery({
    queryKey: keys.society(societyId).notices(status),
    queryFn: ({ pageParam }) =>
      api(noticesContract.list, {
        params: { societyId },
        query: { status, cursor: pageParam, limit: 20 },
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useNotice(societyId: string, noticeId: string) {
  return useQuery({
    queryKey: keys.society(societyId).notice(noticeId),
    queryFn: () => api(noticesContract.get, { params: { societyId, noticeId } }),
  });
}

function useInvalidateNotices(societyId: string) {
  const qc = useQueryClient();
  return (notice?: Notice) => {
    void qc.invalidateQueries({ queryKey: [...keys.society(societyId).all, 'notices'] });
    void qc.invalidateQueries({ queryKey: keys.society(societyId).home });
    if (notice) qc.setQueryData(keys.society(societyId).notice(notice.id), notice);
  };
}

export function useCreateNotice(societyId: string) {
  const invalidate = useInvalidateNotices(societyId);
  return useMutation({
    mutationFn: (body: CreateBody) => api(noticesContract.create, { params: { societyId }, body }),
    onSuccess: (n) => invalidate(n),
  });
}

export function useUpdateNotice(societyId: string, noticeId: string) {
  const invalidate = useInvalidateNotices(societyId);
  return useMutation({
    mutationFn: (body: UpdateBody) =>
      api(noticesContract.update, { params: { societyId, noticeId }, body }),
    onSuccess: (n) => invalidate(n),
  });
}

export function useNoticeAction(societyId: string, noticeId: string) {
  const invalidate = useInvalidateNotices(societyId);
  return useMutation({
    mutationFn: (action: 'publish' | 'archive' | 'pin' | 'unpin') => {
      const params = { societyId, noticeId };
      if (action === 'publish') return api(noticesContract.publish, { params });
      if (action === 'archive') return api(noticesContract.archive, { params });
      return api(noticesContract.setPinned, { params, body: { isPinned: action === 'pin' } });
    },
    onSuccess: (n) => invalidate(n),
  });
}
