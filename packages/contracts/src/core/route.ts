import type { z } from 'zod';
import { EmptySchema } from './common';
import type { ModuleKey, PermissionKey } from './enums';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** none = public. user = any signed-in user. platform = platform admin only. */
export type AuthKind = 'none' | 'user' | 'platform';

export interface RouteDef<
  P extends z.ZodType = z.ZodType,
  Q extends z.ZodType = z.ZodType,
  B extends z.ZodType = z.ZodType,
  R extends z.ZodType = z.ZodType,
> {
  readonly method: HttpMethod;
  /** Full path with Nest style params, for example /v1/societies/:societyId/notices/:noticeId */
  readonly path: string;
  readonly auth: AuthKind;
  /** 'core' routes are always on. A module route is refused when the society has the module off. */
  readonly module: ModuleKey | 'core';
  /** null = any active member (for tenant routes) or any signed-in user (for user routes). */
  readonly permission: PermissionKey | null;
  readonly params: P;
  readonly query: Q;
  readonly body: B;
  readonly response: R;
  readonly summary: string;
}

interface RouteInit<
  P extends z.ZodType,
  Q extends z.ZodType,
  B extends z.ZodType,
  R extends z.ZodType,
> {
  method: HttpMethod;
  path: string;
  summary: string;
  auth?: AuthKind;
  module?: ModuleKey | 'core';
  permission?: PermissionKey | null;
  params?: P;
  query?: Q;
  body?: B;
  response: R;
}

const empty = EmptySchema;
type Empty = typeof empty;

export function defineRoute<
  R extends z.ZodType,
  P extends z.ZodType = Empty,
  Q extends z.ZodType = Empty,
  B extends z.ZodType = Empty,
>(init: RouteInit<P, Q, B, R>): RouteDef<P, Q, B, R> {
  return {
    method: init.method,
    path: init.path,
    summary: init.summary,
    auth: init.auth ?? 'user',
    module: init.module ?? 'core',
    permission: init.permission ?? null,
    params: (init.params ?? empty) as P,
    query: (init.query ?? empty) as Q,
    body: (init.body ?? empty) as B,
    response: init.response,
  };
}

export type RouteInput<T extends RouteDef> = {
  params: z.infer<T['params']>;
  query: z.infer<T['query']>;
  body: z.infer<T['body']>;
};
export type RouteResponse<T extends RouteDef> = z.infer<T['response']>;
export type RouteParams<T extends RouteDef> = z.infer<T['params']>;
export type RouteQuery<T extends RouteDef> = z.infer<T['query']>;
export type RouteBody<T extends RouteDef> = z.infer<T['body']>;

/** Replaces :params in a path. Throws when a param is missing so a typo fails fast. */
export function buildPath(
  path: string,
  params: Record<string, string | number> | undefined,
): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const value = params?.[key];
    if (value === undefined) throw new Error(`Missing path param "${key}" for ${path}`);
    return encodeURIComponent(String(value));
  });
}

/** Turns a query object into ?a=b, skipping undefined. Works in Node and React Native. */
export function buildQuery(query: Record<string, unknown> | undefined): string {
  if (!query) return '';
  const parts: string[] = [];
  const push = (key: string, value: unknown) =>
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) for (const v of value) push(key, v);
    else push(key, value);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}
