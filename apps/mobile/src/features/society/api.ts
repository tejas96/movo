import { societyContract } from '@movo/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';

export function useSocietyProfile(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).profile,
    queryFn: () => api(societyContract.get, { params: { societyId } }),
    staleTime: 60_000,
  });
}
