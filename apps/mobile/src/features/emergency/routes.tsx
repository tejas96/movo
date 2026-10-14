import type { FeatureRoutes } from '../../core/navigation/routes';
import { AlertDetailScreen } from './AlertDetailScreen';
import { EmergencyScreen } from './EmergencyScreen';

export type EmergencyParams = {
  Emergency: undefined;
  AlertDetail: { alertId: string };
};

export const emergencyRoutes: FeatureRoutes<EmergencyParams> = {
  screens: [
    { name: 'Emergency', component: EmergencyScreen, group: 'app' },
    { name: 'AlertDetail', component: AlertDetailScreen, group: 'app' },
  ],
  notifications: [{ kind: 'alert', route: 'AlertDetail', param: 'alertId' }],
};
