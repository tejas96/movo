import { DevSettings } from 'react-native';
import { navigationRef } from '../../core/navigation/navigation-ref';
import type { FeatureRoutes } from '../../core/navigation/routes';
import { GalleryScreen } from './GalleryScreen';

export type DevParams = {
  DevGallery: undefined;
};

/** Debug builds only: the Soft Glow gallery, opened from the React Native dev menu. */
export const devRoutes: FeatureRoutes<DevParams> = {
  screens: [{ name: 'DevGallery', component: GalleryScreen, group: 'app', when: () => __DEV__ }],
};

if (__DEV__) {
  DevSettings.addMenuItem('Soft Glow gallery', () => {
    if (navigationRef.isReady()) navigationRef.navigate('DevGallery');
  });
}
