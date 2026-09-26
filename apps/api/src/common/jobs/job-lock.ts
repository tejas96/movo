import type { PrismaService } from '../prisma/prisma.service';

/**
 * Runs fn while holding a Postgres advisory lock. A second API instance running the same job
 * at the same time skips it. The lock is transaction scoped, so it can never leak.
 */
export async function withJobLock<T>(
  prisma: PrismaService,
  name: string,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(hashtext(${name})) AS locked`;
      if (!rows[0]?.locked) return undefined;
      return fn();
    },
    { timeout: 120_000 },
  );
}
