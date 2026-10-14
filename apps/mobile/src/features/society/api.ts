import { societyContract } from '@movo/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { societyKeys } from './keys';

export function useSocietyProfile(societyId: string) {
  return useQuery({
    queryKey: societyKeys(societyId).profile,
    queryFn: () => api(societyContract.get, { params: { societyId } }),
    staleTime: 60_000,
  });
}
