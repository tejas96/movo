import { Global, Injectable, Module } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';

type Tx = Prisma.TransactionClient;

export interface AccountDeleted {
  userId: string;
  /** Every membership the user ever had, in any society. */
  membershipIds: string[];
}

/**
 * Lifecycle hooks. Core flows (create a society, delete an account) call these inside their
 * own transaction; each feature module registers what it needs in its onModuleInit, so the
 * core does not import feature internals.
 */
@Injectable()
export class Lifecycle {
  private readonly societyCreatedHooks: ((tx: Tx, societyId: string) => Promise<unknown>)[] = [];
  private readonly accountDeletedHooks: ((tx: Tx, e: AccountDeleted) => Promise<unknown>)[] = [];

  /** Default rows a new society starts with. */
  onSocietyCreated(hook: (tx: Tx, societyId: string) => Promise<unknown>): void {
    this.societyCreatedHooks.push(hook);
  }

  /** Clean-up of the deleted user's own rows (listings, open orders, ...). */
  onAccountDeleted(hook: (tx: Tx, e: AccountDeleted) => Promise<unknown>): void {
    this.accountDeletedHooks.push(hook);
  }

  async societyCreated(tx: Tx, societyId: string): Promise<void> {
    for (const hook of this.societyCreatedHooks) await hook(tx, societyId);
  }

  async accountDeleted(tx: Tx, e: AccountDeleted): Promise<void> {
    for (const hook of this.accountDeletedHooks) await hook(tx, e);
  }
}

@Global()
@Module({ providers: [Lifecycle], exports: [Lifecycle] })
export class LifecycleModule {}
