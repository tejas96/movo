import { AsyncLocalStorage } from 'node:async_hooks';
import type { Locale } from '@movo/contracts';
import type { NextFunction, Request, Response } from 'express';
import type { TenantContext } from './tenant/tenant.types';
import { newId } from './util/ids';

export interface RequestUser {
  id: string;
  sessionId: string;
  locale: Locale;
}

export interface RequestStore {
  requestId: string;
  ip: string | undefined;
  user?: RequestUser;
  tenant?: TenantContext;
}

const als = new AsyncLocalStorage<RequestStore>();

/** Express middleware. Opens one store per request so services can read the caller without passing it around. */
export function requestStoreMiddleware(req: Request, res: Response, next: NextFunction): void {
  const headerId = req.header('x-request-id');
  const store: RequestStore = {
    requestId: headerId && headerId.length <= 64 ? headerId : newId(),
    ip: req.ip,
  };
  res.setHeader('x-request-id', store.requestId);
  als.run(store, () => next());
}

export function runWithStore<T>(store: RequestStore, fn: () => T): T {
  return als.run(store, fn);
}

export function getStore(): RequestStore | undefined {
  return als.getStore();
}

export function requireStore(): RequestStore {
  const store = als.getStore();
  if (!store) throw new Error('No request store. Is requestStoreMiddleware installed?');
  return store;
}

export function currentUser(): RequestUser | undefined {
  return als.getStore()?.user;
}

export function requireUser(): RequestUser {
  const user = currentUser();
  if (!user) throw new Error('No authenticated user in request store');
  return user;
}

export function currentTenant(): TenantContext | undefined {
  return als.getStore()?.tenant;
}

export function requireTenant(): TenantContext {
  const tenant = currentTenant();
  if (!tenant) throw new Error('No tenant context in request store');
  return tenant;
}
