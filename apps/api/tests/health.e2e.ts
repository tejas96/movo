import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());

describe('health', () => {
  it('is ok with the build version while the database answers', async () => {
    const res = await h.http().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', version: 'dev' });
  });
  it('is 503 when the database does not answer', async () => {
    const spy = vi.spyOn(h.prisma, '$queryRaw').mockRejectedValueOnce(new Error('down'));
    const res = await h.http().get('/health');
    spy.mockRestore();
    expect(res.status).toBe(503);
  });
});
