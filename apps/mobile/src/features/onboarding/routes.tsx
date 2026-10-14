import type { FeatureRoutes } from '../../core/navigation/routes';
import { JoinScreen } from './JoinScreen';
import { PendingScreen } from './PendingScreen';
import { PickFlatScreen } from './PickFlatScreen';

export type OnboardingParams = {
  Join: undefined;
  PickFlat: { joinCode: string };
  Pending: undefined;
};

export const onboardingRoutes: FeatureRoutes<OnboardingParams> = {
  screens: [
    { name: 'Join', component: JoinScreen, group: ['join', 'app'] },
    { name: 'PickFlat', component: PickFlatScreen, group: ['join', 'app'] },
    { name: 'Pending', component: PendingScreen, group: ['join', 'app'] },
  ],
};
