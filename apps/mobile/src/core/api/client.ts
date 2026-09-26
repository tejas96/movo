import {
  type AuthTokens,
  authContract,
  buildPath,
  buildQuery,
  type RouteDef,
  type RouteInput,
  type RouteResponse,
} from '@movo/contracts';
import { useSessionStore } from '../auth/session.store';
import { clearRefreshToken, loadRefreshToken, saveRefreshToken } from '../auth/token-storage';
import { API_URL, APP_VERSION } from '../env';
import { i18n } from '../i18n';
import { ApiError } from './errors';
import { queryClient } from './query-client';

type Input<T extends RouteDef> = Partial<RouteInput<T>>;

const REFRESH_SKEW_MS = 30_000;
let refreshing: Promise<AuthTokens | null> | null = null;

async function rawFetch(
  method: string,
  url: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the server', 0);
  }
  const text = await res.text();
  let json: Record<string, unknown> = {};
  if (text) {
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = {};
    }
  }
  return { status: res.status, json };
}

function baseHeaders(): Record<string, string> {
  return {
    'content-type': 'application/json',
    accept: 'application/json',
    'x-app-version': APP_VERSION,
    'accept-language': i18n.language,
  };
}

/** One refresh at a time. Everyone waiting gets the same result. */
export function refreshTokens(): Promise<AuthTokens | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await loadRefreshToken();
      if (!refreshToken) return null;
      const { status, json } = await rawFetch(
        'POST',
        `${API_URL}${authContract.refresh.path}`,
        { refreshToken },
        baseHeaders(),
      );
      if (status !== 201 && status !== 200) return null;
      const tokens = json as unknown as AuthTokens;
      await saveRefreshToken(tokens.refreshToken);
      useSessionStore.getState().setTokens(tokens);
      return tokens;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function ensureAccessToken(): Promise<string | null> {
  const { accessToken, accessTokenExpiresAt } = useSessionStore.getState();
  if (accessToken && accessTokenExpiresAt && accessTokenExpiresAt - Date.now() > REFRESH_SKEW_MS)
    return accessToken;
  const tokens = await refreshTokens();
  return tokens?.accessToken ?? accessToken;
}

export async function signOutLocally(): Promise<void> {
  await clearRefreshToken();
  useSessionStore.getState().setSignedOut();
  queryClient.clear();
}

/**
 * The only way the app talks to the API. Typed by the contract: params, query, body in,
 * response out. Handles auth headers, silent refresh, error shaping, and dev-time contract checks.
 */
export async function api<T extends RouteDef>(
  route: T,
  input: Input<T> = {},
  retry = true,
): Promise<RouteResponse<T>> {
  const url = `${API_URL}${buildPath(route.path, input.params as Record<string, string> | undefined)}${buildQuery(input.query as Record<string, unknown> | undefined)}`;
  const headers = baseHeaders();
  if (route.auth !== 'none') {
    const token = await ensureAccessToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const { status, json } = await rawFetch(route.method, url, input.body, headers);

  if (status === 401 && route.auth !== 'none') {
    if (retry) {
      const tokens = await refreshTokens();
      if (tokens) return api(route, input, false);
    }
    await signOutLocally();
  }
  if (status >= 400) {
    throw new ApiError(
      (json.code as ApiError['code']) ?? 'INTERNAL',
      (json.message as string) ?? 'Request failed',
      status,
      json.details,
      json.requestId as string | undefined,
    );
  }
  if (__DEV__) {
    const parsed = route.response.safeParse(json);
    if (!parsed.success)
      console.warn(`[contract] ${route.method} ${route.path}`, parsed.error.issues.slice(0, 3));
  }
  return json as RouteResponse<T>;
}
