import { describe, expect, it } from 'vitest';
import * as contracts from '../index';
import { API_PREFIX, type RouteDef } from './route';

const isRoute = (v: unknown): v is RouteDef =>
  typeof v === 'object' && v !== null && 'path' in v && 'method' in v && 'response' in v;

const routes = Object.entries(contracts).flatMap(([name, value]) =>
  typeof value === 'object' && value !== null
    ? Object.entries(value)
        .filter(([, r]) => isRoute(r))
        .map(([key, r]) => [`${name}.${key}`, (r as RouteDef).path] as const)
    : [],
);

describe('route paths', () => {
  it('finds the routes', () => {
    expect(routes.length).toBeGreaterThan(150);
  });
  it('puts every route but health under API_PREFIX once', () => {
    const wrong = routes.filter(
      ([name, path]) =>
        name !== 'appContract.health' &&
        (!path.startsWith(`${API_PREFIX}/`) || path.startsWith(`${API_PREFIX}${API_PREFIX}/`)),
    );
    expect(wrong).toEqual([]);
  });
  it('keeps the upload path constants in step with their routes', () => {
    expect(contracts.filesContract.upload.path).toBe(contracts.FILE_UPLOAD_PATH);
    expect(contracts.meContract.setAvatar.path).toBe(contracts.AVATAR_UPLOAD_PATH);
    expect(contracts.meContract.removeAvatar.path).toBe(contracts.AVATAR_UPLOAD_PATH);
  });
});
