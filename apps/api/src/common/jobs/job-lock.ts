import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

const logger = new Logger('JobLease');
/** How long a lease lasts without renewal. The holder renews it every third of this. */
export const LEASE_MS = 120_000;

type Db = Pick<PrismaService, '$queryRaw' | '$executeRaw'>;

/**
 * Takes the job's lease if nobody holds it (or the holder's lease ran out). One atomic
 * statement: the insert wins when there is no row, the update only when the row has expired.
 */
export async function acquireLease(
  db: Db,
  name: string,
  holder: string,
  ttlMs = LEASE_MS,
): Promise<boolean> {
  const rows = await db.$queryRaw<{ holder: string }[]>`
    INSERT INTO "JobLease" ("name", "holder", "expiresAt", "updatedAt")
    VALUES (${name}, ${holder},
            (now() AT TIME ZONE 'UTC') + make_interval(secs => ${ttlMs / 1000}),
            (now() AT TIME ZONE 'UTC'))
    ON CONFLICT ("name") DO UPDATE
      SET "holder" = EXCLUDED."holder", "expiresAt" = EXCLUDED."expiresAt",
          "updatedAt" = EXCLUDED."updatedAt"
      WHERE "JobLease"."expiresAt" < (now() AT TIME ZONE 'UTC')
    RETURNING "holder"`;
  return rows[0]?.holder === holder;
}

/** Extends our lease. False when it is no longer ours (it lapsed and someone took it). */
export async function renewLease(
  db: Db,
  name: string,
  holder: string,
  ttlMs = LEASE_MS,
): Promise<boolean> {
  const n = await db.$executeRaw`
    UPDATE "JobLease"
    SET "expiresAt" = (now() AT TIME ZONE 'UTC') + make_interval(secs => ${ttlMs / 1000}),
        "updatedAt" = (now() AT TIME ZONE 'UTC')
    WHERE "name" = ${name} AND "holder" = ${holder}`;
  return n > 0;
}

export async function releaseLease(db: Db, name: string, holder: string): Promise<void> {
  await db.$executeRaw`DELETE FROM "JobLease" WHERE "name" = ${name} AND "holder" = ${holder}`;
}

/**
 * Runs fn while holding the job's lease, so only one API instance runs a job at a time.
 * Returns undefined (and runs nothing) when another instance holds it. The lease is renewed
 * while fn runs, however long that takes, and released at the end. No connection or
 * transaction is held for the run: fn manages its own, short transactions.
 */
export async function withJobLock<T>(
  prisma: Db,
  name: string,
  fn: () => Promise<T>,
  ttlMs = LEASE_MS,
): Promise<T | undefined> {
  const holder = `${hostname()}:${process.pid}:${randomUUID()}`;
  if (!(await acquireLease(prisma, name, holder, ttlMs))) return undefined;
  const timer = setInterval(() => {
    renewLease(prisma, name, holder, ttlMs)
      .then((ours) => {
        if (!ours) logger.warn(`${name}: lease lost while running`);
      })
      .catch((error: unknown) =>
        logger.warn(`${name}: lease renewal failed: ${(error as Error).message}`),
      );
  }, ttlMs / 3);
  timer.unref();
  try {
    return await fn();
  } finally {
    clearInterval(timer);
    await releaseLease(prisma, name, holder).catch((error: unknown) =>
      logger.warn(`${name}: lease release failed: ${(error as Error).message}`),
    );
  }
}
