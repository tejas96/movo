import { societyContract } from '@movo/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { societyKeys } from './keys';
import { manageKeys } from './manage-keys';

export function useSocietyProfile(societyId: string) {
  return useQuery({
    queryKey: societyKeys(societyId).profile,
    queryFn: () => api(societyContract.get, { params: { societyId } }),
    staleTime: 60_000,
  });
}

export function useBuildings(societyId: string) {
  return useQuery({
    queryKey: manageKeys(societyId).buildings,
    queryFn: () => api(societyContract.listBuildings, { params: { societyId } }),
  });
}

export function useFlats(societyId: string) {
  return useQuery({
    queryKey: manageKeys(societyId).flats,
    queryFn: () => api(societyContract.listFlats, { params: { societyId } }),
  });
}
