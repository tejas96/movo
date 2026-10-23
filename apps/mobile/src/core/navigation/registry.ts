import { authRoutes } from '../../features/auth/routes';
import { devRoutes } from '../../features/dev/routes';
import { directoryRoutes } from '../../features/directory/routes';
import { dutiesRoutes } from '../../features/duties/routes';
import { emergencyRoutes } from '../../features/emergency/routes';
import { eventsRoutes } from '../../features/events/routes';
import { expensesRoutes } from '../../features/expenses/routes';
import { homeRoutes } from '../../features/home/routes';
import { manageRoutes } from '../../features/manage/routes';
import { marketRoutes } from '../../features/market/routes';
import { meRoutes } from '../../features/me/routes';
import { meetingsRoutes } from '../../features/meetings/routes';
import { moneyRoutes } from '../../features/money/routes';
import { noticesRoutes } from '../../features/notices/routes';
import { onboardingRoutes } from '../../features/onboarding/routes';
import { parkingRoutes } from '../../features/parking/routes';
import { rewardsRoutes } from '../../features/rewards/routes';
import { servicesRoutes } from '../../features/services/routes';
import { tasksRoutes } from '../../features/tasks/routes';
import { setNotificationTargets } from '../notifications/open-target';
import { arRoutes } from './ar-routes';
import { MainTabs } from './MainTabs';
import type { AnyFeatureRoutes, AnyNotificationEntry, FeatureRoutes, ScreenEntry } from './routes';
import type { ShellParams } from './types';

const shellRoutes: FeatureRoutes<ShellParams> = {
  screens: [{ name: 'Tabs', component: MainTabs, group: 'app' }],
};

/**
 * Every feature's routes, in stack order. The first screen of a group is where that group
 * starts (Tabs for the app, Welcome or Login when signed out, Join without a society).
 * Adding a feature: write its `routes.tsx` and add it here. `RootStackParamList` follows.
 */
export const featureRoutes = [
  shellRoutes,
  authRoutes,
  onboardingRoutes,
  homeRoutes,
  noticesRoutes,
  directoryRoutes,
  marketRoutes,
  meRoutes,
  manageRoutes,
  servicesRoutes,
  parkingRoutes,
  arRoutes,
  emergencyRoutes,
  meetingsRoutes,
  eventsRoutes,
  moneyRoutes,
  expensesRoutes,
  dutiesRoutes,
  tasksRoutes,
  rewardsRoutes,
  devRoutes,
] as const;

const features: readonly AnyFeatureRoutes[] = featureRoutes;

export const screens: readonly ScreenEntry[] = features.flatMap((f) => f.screens);

export const notificationTargets: readonly AnyNotificationEntry[] = features.flatMap(
  (f) => f.notifications ?? [],
);

// open-target.ts is imported by screens, so it cannot import this file without a require cycle.
setNotificationTargets(notificationTargets);
