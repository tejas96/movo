import {
  type AuthTokens,
  authContract,
  buildPath,
  buildQuery,
  type FileRef,
  filesContract,
  meContract,
  type RouteDef,
  type RouteInput,
  type RouteResponse,
  type UploadKind,
  type User,
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

export interface UploadAsset {
  uri: string;
  fileName?: string | undefined;
  type?: string | undefined;
}

/**
 * Multipart upload of one photo (field "file"). Not a JSON route, so it lives beside api().
 * Same auth header and one silent refresh on 401.
 */
async function postPhoto<T>(path: string, asset: UploadAsset, retry = true): Promise<T> {
  const url = `${API_URL}${path}`;
  const form = new FormData();
  const type = asset.type ?? 'image/jpeg';
  const name = asset.fileName ?? `photo.${type.split('/')[1] ?? 'jpg'}`;
  // React Native's FormData takes a {uri, name, type} object for files.
  form.append('file', { uri: asset.uri, name, type } as unknown as Blob);
  const headers: Record<string, string> = {
    accept: 'application/json',
    'x-app-version': APP_VERSION,
    'accept-language': i18n.language,
  };
  const token = await ensureAccessToken();
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, body: form });
  } catch {
    throw new ApiError('NETWORK', 'Cannot reach the server', 0);
  }
  if (res.status === 401) {
    if (retry) {
      const tokens = await refreshTokens();
      if (tokens) return postPhoto<T>(path, asset, false);
    }
    await signOutLocally();
  }
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = {};
  }
  if (res.status >= 400) {
    throw new ApiError(
      (json.code as ApiError['code']) ?? 'INTERNAL',
      (json.message as string) ?? 'Upload failed',
      res.status,
      json.details,
      json.requestId as string | undefined,
    );
  }
  return json as unknown as T;
}

/** A society photo. It stays unused until a form saves it with its id. */
export function uploadFile(
  societyId: string,
  asset: UploadAsset,
  kind: UploadKind,
): Promise<FileRef> {
  return postPhoto<FileRef>(
    `${buildPath(filesContract.upload.path, { societyId })}?kind=${kind}`,
    asset,
  );
}

/** Sets my profile photo and returns my updated profile. */
export function uploadAvatar(asset: UploadAsset): Promise<User> {
  return postPhoto<User>(meContract.setAvatar.path, asset);
}

/** A stored file's url is a relative signed path. Images load it straight, no auth header. */
export function fileUri(ref: Pick<FileRef, 'url'>): string {
  return /^https?:/.test(ref.url) ? ref.url : `${API_URL}${ref.url}`;
}

/** For a url field that may be empty: avatarUrl, logoUrl. */
export function photoUri(url: string | null | undefined): string | null {
  return url ? fileUri({ url }) : null;
}
