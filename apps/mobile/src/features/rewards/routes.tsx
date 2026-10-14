import type { FeatureRoutes } from '../../core/navigation/routes';
import { RewardsScreen } from './RewardsScreen';

export type RewardsParams = {
  Rewards: undefined;
};

export const rewardsRoutes: FeatureRoutes<RewardsParams> = {
  screens: [{ name: 'Rewards', component: RewardsScreen, group: 'app' }],
};
