import {
  type Notice,
  type NoticeStatusSchema,
  noticesContract,
  type RouteBody,
} from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { z } from 'zod';
import { api } from '../../core/api/client';
import { useCursorList } from '../../core/api/use-cursor-list';
import { noticesKeys } from './keys';

type Status = z.infer<typeof NoticeStatusSchema>;
type CreateBody = RouteBody<typeof noticesContract.create>;
type UpdateBody = RouteBody<typeof noticesContract.update>;

export function useNotices(societyId: string, status: Status) {
  return useCursorList({
    queryKey: noticesKeys(societyId).list(status),
    fetchPage: (cursor) =>
      api(noticesContract.list, {
        params: { societyId },
        query: { status, cursor, limit: 20 },
      }),
  });
}

export function useNotice(societyId: string, noticeId: string) {
  return useQuery({
    queryKey: noticesKeys(societyId).detail(noticeId),
    queryFn: () => api(noticesContract.get, { params: { societyId, noticeId } }),
  });
}

function useInvalidateNotices(societyId: string) {
  const qc = useQueryClient();
  return (notice?: Notice) => {
    void qc.invalidateQueries({ queryKey: noticesKeys(societyId).lists });
    if (notice) qc.setQueryData(noticesKeys(societyId).detail(notice.id), notice);
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
