import type { FeatureRoutes } from '../../core/navigation/routes';
import { NotificationsScreen } from './NotificationsScreen';

export type HomeParams = {
  Notifications: undefined;
};

export const homeRoutes: FeatureRoutes<HomeParams> = {
  screens: [{ name: 'Notifications', component: NotificationsScreen, group: 'app' }],
};
