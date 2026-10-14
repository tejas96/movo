import type { Prisma } from '../../generated/prisma/client';

/**
 * Waits for a Postgres advisory lock named `key`, held until the transaction ends. Use it to
 * serialise read-then-write steps on one thing (a member's points, a flat's dues) across
 * requests and API instances.
 */
export async function lockFor(tx: Prisma.TransactionClient, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
