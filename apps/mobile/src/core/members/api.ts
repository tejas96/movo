import { societyContract } from '@movo/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useCursorList } from '../api/use-cursor-list';
import { manageKeys } from '../society/manage-keys';
import { directoryKeys } from './keys';

export function useMembers(societyId: string, q: string, buildingId?: string) {
  return useCursorList({
    queryKey: directoryKeys(societyId).list(`${q}|${buildingId ?? ''}`),
    fetchPage: (cursor) =>
      api(societyContract.listMembers, {
        params: { societyId },
        query: { q: q || undefined, buildingId, cursor, limit: 30 },
      }),
    staleTime: 60_000,
  });
}

export function useRoles(societyId: string) {
  return useQuery({
    queryKey: manageKeys(societyId).roles,
    queryFn: () => api(societyContract.listRoles, { params: { societyId } }),
    staleTime: 5 * 60_000,
  });
}
