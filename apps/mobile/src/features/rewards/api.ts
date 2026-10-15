import { rewardsContract } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { rewardsKeys } from '../../core/rewards/keys';

const c = rewardsContract;

export function useMyPoints(societyId: string) {
  return useQuery({
    queryKey: rewardsKeys(societyId).mine,
    queryFn: () => api(c.mine, { params: { societyId } }),
  });
}

export function useLeaderboard(societyId: string, enabled: boolean) {
  return useQuery({
    queryKey: rewardsKeys(societyId).leaderboard,
    queryFn: () => api(c.leaderboard, { params: { societyId } }),
    enabled,
  });
}

export function useAdjustPoints(societyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { membershipId: string; delta: number; note: string }) =>
      api(c.adjust, { params: { societyId }, body }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: rewardsKeys(societyId).all });
    },
  });
}
