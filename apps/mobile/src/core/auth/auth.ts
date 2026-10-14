import { type AuthSession, authContract, type Locale, meContract } from '@movo/contracts';
import { Platform } from 'react-native';
import { api, refreshTokens, signOutLocally } from '../api/client';
import { queryClient } from '../api/query-client';
import { meKey } from '../api/query-keys';
import { setAppLocale } from '../i18n';
import { unregisterPush } from '../push/push';
import { useSessionStore } from './session.store';
import { loadRefreshToken, saveRefreshToken } from './token-storage';

const device = { platform: Platform.OS === 'android' ? ('ANDROID' as const) : ('IOS' as const) };

async function persist(session: AuthSession): Promise<void> {
  await saveRefreshToken(session.tokens.refreshToken);
  useSessionStore.getState().setSignedIn(session.user, session.tokens);
  await setAppLocale(session.user.locale);
}

export async function signIn(identifier: string, password: string): Promise<void> {
  const session = await api(authContract.login, { body: { identifier, password, device } });
  await persist(session);
}

export async function signUp(input: {
  identifier: string;
  password: string;
  displayName: string;
  locale: Locale;
}): Promise<void> {
  const session = await api(authContract.register, { body: { ...input, device } });
  await persist(session);
}

export async function signOut(): Promise<void> {
  // First, while the access token is still valid: stop pushes to this phone.
  await unregisterPush().catch(() => {});
  try {
    const refreshToken = await loadRefreshToken();
    await api(authContract.logout, { body: refreshToken ? { refreshToken } : {} }, false);
  } catch {
    // best effort; local sign out always happens
  }
  await signOutLocally();
}

/**
 * Called once at launch. Warm token -> signed in. Refresh token -> refresh -> signed in.
 * Refresh cannot reach the server -> signed in with the saved session. Else signed out.
 */
export async function bootstrapSession(): Promise<void> {
  const store = useSessionStore.getState();
  const warm =
    store.accessToken &&
    store.accessTokenExpiresAt &&
    store.accessTokenExpiresAt - Date.now() > 60_000;
  if (warm) {
    store.setBooted(true);
    void refreshProfile();
    return;
  }
  try {
    const tokens = await refreshTokens();
    if (!tokens) {
      await signOutLocally();
      return;
    }
  } catch {
    // Offline or the server is down: keep the saved session and open the app. The next
    // request refreshes the token again; only a 401/403 from refresh ever signs out.
    store.setBooted(true);
    return;
  }
  store.setBooted(true);
  void refreshProfile();
}

async function refreshProfile(): Promise<void> {
  try {
    const user = await api(meContract.get);
    useSessionStore.getState().setUser(user);
  } catch {
    // offline start is fine; the persisted profile stays
  }
}

export function invalidateContext(): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: meKey });
}
