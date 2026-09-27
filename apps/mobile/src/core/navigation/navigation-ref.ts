import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** For navigation from outside a screen, e.g. a tapped push notification. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
