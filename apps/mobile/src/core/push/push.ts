import { meContract } from '@movo/contracts';
import { getApps } from '@react-native-firebase/app';
import {
  deleteToken,
  getInitialNotification,
  getMessaging,
  getToken,
  type Messaging,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { api } from '../api/client';
import { APP_VERSION } from '../env';
import { kv } from '../storage/mmkv';

const ASKED_KEY = 'push.permissionAsked';
const TOKEN_KEY = 'push.token';

/**
 * Firebase messaging, or null when this build has no Firebase config (no google-services.json)
 * or the native side failed to start. Every push call goes through here, so the app runs without it.
 */
export function pushMessaging(): Messaging | null {
  try {
    if (getApps().length === 0) return null;
    return getMessaging();
  } catch {
    return null;
  }
}

export const pushAvailable = (): boolean => pushMessaging() !== null;

/**
 * Android 13+ needs POST_NOTIFICATIONS at runtime. Asked once, after sign-in with a society,
 * never on the login screen. A "no" is respected; the member can turn it on in system settings.
 */
async function ensurePermission(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) return;
  if (kv.get(ASKED_KEY)) return;
  kv.set(ASKED_KEY, '1');
  await PermissionsAndroid.request(permission);
}

async function sendToken(token: string): Promise<void> {
  await api(meContract.registerDevice, {
    body: {
      token,
      platform: Platform.OS === 'android' ? 'ANDROID' : 'IOS',
      appVersion: APP_VERSION,
    },
  });
  kv.set(TOKEN_KEY, token);
}

/** Asks for permission if needed, then registers this device's FCM token with the API. */
export async function registerForPush(): Promise<void> {
  const m = pushMessaging();
  if (!m) return;
  await ensurePermission();
  const token = await getToken(m);
  if (__DEV__) console.warn('[push] token', token);
  if (token) await sendToken(token);
}

/** FCM rotates tokens now and then. The new one replaces the old on the API. */
export function watchTokenRefresh(): () => void {
  const m = pushMessaging();
  if (!m) return () => {};
  return onTokenRefresh(m, (token) => {
    void sendToken(token).catch(() => {});
  });
}

/**
 * Before signing out: tell the API to forget this device (needs the access token, so it runs
 * first), then drop the token locally so the next account on this phone gets a fresh one.
 */
export async function unregisterPush(): Promise<void> {
  const m = pushMessaging();
  const token = kv.get(TOKEN_KEY);
  kv.remove(TOKEN_KEY);
  if (token) {
    try {
      await api(meContract.removeDevice, { body: { token } }, false);
    } catch {
      // best effort; the API also drops tokens FCM reports as dead
    }
  }
  if (m) await deleteToken(m).catch(() => {});
}

export function onForegroundMessage(listener: (message: RemoteMessage) => void): () => void {
  const m = pushMessaging();
  return m ? onMessage(m, async (message) => listener(message)) : () => {};
}

/** Taps on a notification while the app was in the background. */
export function onNotificationTap(listener: (message: RemoteMessage) => void): () => void {
  const m = pushMessaging();
  return m ? onNotificationOpenedApp(m, listener) : () => {};
}

/** The notification whose tap launched the app from quit, if any. */
export async function initialNotification(): Promise<RemoteMessage | null> {
  const m = pushMessaging();
  if (!m) return null;
  try {
    return await getInitialNotification(m);
  } catch {
    return null;
  }
}
