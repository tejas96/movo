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

/** What a request sends: a JSON body, or a multipart form built fresh for each try. */
type Payload = { json: unknown } | { form: () => FormData };

async function rawFetch(
  method: string,
  url: string,
  payload: Payload,
  headers: Record<string, string>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body:
        'form' in payload
          ? payload.form()
          : method === 'GET'
            ? undefined
            : JSON.stringify(payload.json ?? {}),
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

/** Multipart bodies set their own content-type (with the boundary), so only JSON names one. */
function baseHeaders(json = true): Record<string, string> {
  return {
    ...(json ? { 'content-type': 'application/json' } : {}),
    accept: 'application/json',
    'x-app-version': APP_VERSION,
    'accept-language': i18n.language,
  };
}

/**
 * One refresh at a time. Everyone waiting gets the same result.
 * Null means the session is over (no saved token, or the server said 401/403): sign out.
 * Anything else (offline, 5xx, a bad body) throws a retryable ApiError and keeps the saved token.
 */
export function refreshTokens(): Promise<AuthTokens | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const refreshToken = await loadRefreshToken();
      if (!refreshToken) return null;
      const { status, json } = await rawFetch(
        'POST',
        `${API_URL}${authContract.refresh.path}`,
        { json: { refreshToken } },
        baseHeaders(),
      );
      if (status === 401 || status === 403) return null;
      if (status !== 201 && status !== 200) {
        throw new ApiError(
          (json.code as ApiError['code']) ?? 'INTERNAL',
          (json.message as string) ?? 'Refresh failed',
          status >= 400 ? status : 500,
          json.details,
          json.requestId as string | undefined,
        );
      }
      const parsed = authContract.refresh.response.safeParse(json);
      if (!parsed.success) throw new ApiError('INTERNAL', 'Bad refresh response', 500);
      const tokens = parsed.data;
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

function routeUrl<T extends RouteDef>(route: T, input: Input<T>): string {
  return `${API_URL}${buildPath(route.path, input.params as Record<string, string> | undefined)}${buildQuery(input.query as Record<string, unknown> | undefined)}`;
}

/**
 * The one request path under api() and the photo upload: auth header, one silent refresh and
 * retry on 401 (sign out when that fails), error shaping, and dev-time contract checks.
 */
async function request<T extends RouteDef>(
  route: T,
  url: string,
  payload: Payload,
  failMessage: string,
  retry = true,
): Promise<RouteResponse<T>> {
  const headers = baseHeaders(!('form' in payload));
  if (route.auth !== 'none') {
    const token = await ensureAccessToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  const { status, json } = await rawFetch(route.method, url, payload, headers);

  if (status === 401 && route.auth !== 'none') {
    if (retry) {
      const tokens = await refreshTokens();
      if (tokens) return request(route, url, payload, failMessage, false);
    }
    await signOutLocally();
  }
  if (status >= 400) {
    throw new ApiError(
      (json.code as ApiError['code']) ?? 'INTERNAL',
      (json.message as string) ?? failMessage,
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

/**
 * The only way the app talks to the API. Typed by the contract: params, query, body in,
 * response out.
 */
export function api<T extends RouteDef>(
  route: T,
  input: Input<T> = {},
  /** False: no refresh-and-retry on 401 (used while signing out). */
  retry = true,
): Promise<RouteResponse<T>> {
  return request(route, routeUrl(route, input), { json: input.body }, 'Request failed', retry);
}

export interface UploadAsset {
  uri: string;
  fileName?: string | undefined;
  type?: string | undefined;
}

/** Multipart upload of one photo (field "file") to a contract route. */
function postPhoto<T extends RouteDef>(
  route: T,
  input: Input<T>,
  asset: UploadAsset,
): Promise<RouteResponse<T>> {
  const type = asset.type ?? 'image/jpeg';
  const name = asset.fileName ?? `photo.${type.split('/')[1] ?? 'jpg'}`;
  const form = () => {
    const data = new FormData();
    // React Native's FormData takes a {uri, name, type} object for files.
    data.append('file', { uri: asset.uri, name, type } as unknown as Blob);
    return data;
  };
  return request(route, routeUrl(route, input), { form }, 'Upload failed');
}

/** A society photo. It stays unused until a form saves it with its id. */
export function uploadFile(
  societyId: string,
  asset: UploadAsset,
  kind: UploadKind,
): Promise<FileRef> {
  return postPhoto(filesContract.upload, { params: { societyId }, query: { kind } }, asset);
}

/** Sets my profile photo and returns my updated profile. */
export function uploadAvatar(asset: UploadAsset): Promise<User> {
  return postPhoto(meContract.setAvatar, {}, asset);
}

/** A stored file's url is a relative signed path. Images load it straight, no auth header. */
export function fileUri(ref: Pick<FileRef, 'url'>): string {
  return /^https?:/.test(ref.url) ? ref.url : `${API_URL}${ref.url}`;
}

/** For a url field that may be empty: avatarUrl, logoUrl. */
export function photoUri(url: string | null | undefined): string | null {
  return url ? fileUri({ url }) : null;
}
