import { rewardsContract } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { keys } from '../../core/api/keys';

const c = rewardsContract;

export function useMyPoints(societyId: string) {
  return useQuery({
    queryKey: keys.society(societyId).rewardsMine,
    queryFn: () => api(c.mine, { params: { societyId } }),
  });
}

export function useLeaderboard(societyId: string, enabled: boolean) {
  return useQuery({
    queryKey: keys.society(societyId).leaderboard,
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
      void qc.invalidateQueries({ queryKey: keys.society(societyId).rewards });
      void qc.invalidateQueries({ queryKey: keys.society(societyId).home });
    },
  });
}
