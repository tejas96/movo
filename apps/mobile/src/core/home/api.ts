import { homeContract } from '@movo/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { homeKeys } from './keys';

export function useHomeSummary(societyId: string) {
  return useQuery({
    queryKey: homeKeys(societyId).all,
    queryFn: () => api(homeContract.summary, { params: { societyId } }),
    staleTime: 15_000,
  });
}
