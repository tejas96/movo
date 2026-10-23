import { maintenanceContract } from '@movo/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { moneyKeys } from './keys';

/** The signed-in member's dues. Shared: the Money tab and the Home dues card both read it. */
export function useMyDues(societyId: string, enabled = true) {
  return useQuery({
    queryKey: moneyKeys(societyId).myDues,
    queryFn: () => api(maintenanceContract.myDues, { params: { societyId } }),
    enabled,
  });
}
