import { ARScreen } from '../../features/ar/ARScreen';
import { FloorMapScreen } from '../../features/ar/FloorMapScreen';
import type { FeatureRoutes } from './routes';

/** The AR guide's screens. Kept here so the AR track's folder stays its own. */
export type ArParams = {
  AR: undefined;
  FloorMap: { levelId?: string; destinationId?: string } | undefined;
};

export const arRoutes: FeatureRoutes<ArParams> = {
  screens: [
    { name: 'AR', component: ARScreen, group: 'app', options: { animation: 'fade' } },
    { name: 'FloorMap', component: FloorMapScreen, group: 'app' },
  ],
};
