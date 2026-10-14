import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildPath, buildQuery, defineRoute } from './route';

describe('defineRoute', () => {
  it('fills defaults', () => {
    const r = defineRoute({ method: 'GET', path: '/x', summary: 's', response: z.object({}) });
    expect(r.path).toBe('/v1/x');
    expect(r.auth).toBe('user');
    expect(r.module).toBe('core');
    expect(r.permission).toBeNull();
    expect(r.params.safeParse({}).success).toBe(true);
  });
  it('leaves an unversioned path alone', () => {
    const r = defineRoute({
      method: 'GET',
      path: '/health',
      versioned: false,
      summary: 's',
      response: z.object({}),
    });
    expect(r.path).toBe('/health');
  });
  it('builds paths and queries', () => {
    expect(
      buildPath('/v1/societies/:societyId/notices/:noticeId', { societyId: 'a b', noticeId: '1' }),
    ).toBe('/v1/societies/a%20b/notices/1');
    expect(() => buildPath('/v1/:id', {})).toThrow();
    expect(buildQuery({ limit: 20, cursor: undefined, q: 'x y' })).toBe('?limit=20&q=x%20y');
    expect(buildQuery(undefined)).toBe('');
  });
});
