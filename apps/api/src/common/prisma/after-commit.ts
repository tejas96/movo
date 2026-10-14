/**
 * Work that must wait until a transaction has committed (sending a push the transaction just
 * queued). TenantPrismaService.tx tracks its transactions; afterCommit returns false for any
 * other client, and the caller falls back to its slower path.
 */
const queues = new WeakMap<object, (() => Promise<unknown>)[]>();

export function afterCommit(tx: object, fn: () => Promise<unknown>): boolean {
  const queue = queues.get(tx);
  if (!queue) return false;
  queue.push(fn);
  return true;
}

/** Marks `tx` as tracked; `queue` collects its afterCommit work. */
export function trackTransaction(tx: object, queue: (() => Promise<unknown>)[]): void {
  queues.set(tx, queue);
}
