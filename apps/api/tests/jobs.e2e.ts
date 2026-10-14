import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { acquireLease, renewLease, withJobLock } from '../src/common/jobs/job-lock';
import { createHarness, type Harness } from './harness';

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(() => h.reset());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('job lease', () => {
  it('runs a job on one instance at a time and frees it at the end', async () => {
    const order: string[] = [];
    const first = withJobLock(h.prisma, 'test:job', async () => {
      order.push('first start');
      await sleep(300);
      order.push('first end');
      return 'first';
    });
    await sleep(50);
    const second = await withJobLock(h.prisma, 'test:job', async () => 'second');
    expect(second).toBeUndefined();
    expect(await first).toBe('first');
    expect(order).toEqual(['first start', 'first end']);
    expect(await h.prisma.jobLease.count()).toBe(0);
    expect(await withJobLock(h.prisma, 'test:job', async () => 'again')).toBe('again');
  });

  it('frees the lease when the job throws', async () => {
    await expect(
      withJobLock(h.prisma, 'test:boom', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await withJobLock(h.prisma, 'test:boom', async () => 1)).toBe(1);
  });

  it('renews the lease while a long job runs, past the lease time', async () => {
    const ttl = 300;
    const long = withJobLock(
      h.prisma,
      'test:long',
      async () => {
        await sleep(ttl * 3);
        return 'done';
      },
      ttl,
    );
    await sleep(ttl * 2);
    // Without renewal the lease would have run out by now.
    expect(await acquireLease(h.prisma, 'test:long', 'other', ttl)).toBe(false);
    expect(await long).toBe('done');
  });

  it('lets another instance take a lease its holder stopped renewing', async () => {
    expect(await acquireLease(h.prisma, 'test:dead', 'crashed', 100)).toBe(true);
    expect(await acquireLease(h.prisma, 'test:dead', 'other', 100)).toBe(false);
    await sleep(150);
    expect(await acquireLease(h.prisma, 'test:dead', 'other', 100)).toBe(true);
    // The old holder finds out it lost the lease.
    expect(await renewLease(h.prisma, 'test:dead', 'crashed', 100)).toBe(false);
  });
});
