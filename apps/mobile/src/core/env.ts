import { Platform } from 'react-native';
import Config from 'react-native-config';

const FALLBACK = Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
const configured = Config.API_URL;

/**
 * .env is shared by both platforms. 10.0.2.2 is the Android emulator's alias for the Mac;
 * the iOS simulator reaches the Mac through localhost, so swap it there.
 */
export const API_URL: string =
  Platform.OS === 'ios' && configured?.includes('10.0.2.2')
    ? configured.replace('10.0.2.2', 'localhost')
    : (configured ?? FALLBACK);
export const APP_VERSION = '0.1.0';
