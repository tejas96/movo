import { societyKey } from '../../core/api/query-keys';

export const rewardsKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    all: [...root, 'rewards'] as const,
    mine: [...root, 'rewards', 'me'] as const,
    leaderboard: [...root, 'rewards', 'board'] as const,
  };
};
