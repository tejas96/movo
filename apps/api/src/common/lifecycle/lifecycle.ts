import { Global, Injectable, Module } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';

type Tx = Prisma.TransactionClient;

export interface MemberLeft {
  membershipId: string;
  societyId: string;
  userId: string;
  /** Why the membership ended; only changes the note written on released work. */
  reason?: 'left' | 'account-deleted';
}

export interface AccountDeleted {
  userId: string;
  /** Every membership the user ever had, in any society. */
  memberships: { id: string; societyId: string }[];
}

/**
 * Lifecycle hooks. Core flows (create a society, end a membership, delete an account) call
 * these inside their own transaction; each feature module registers what it needs in its
 * onModuleInit, so the core does not import feature internals.
 */
@Injectable()
export class Lifecycle {
  private readonly societyCreatedHooks: ((tx: Tx, societyId: string) => Promise<unknown>)[] = [];
  private readonly memberLeftHooks: ((tx: Tx, e: MemberLeft) => Promise<unknown>)[] = [];
  private readonly accountDeletedHooks: ((tx: Tx, e: AccountDeleted) => Promise<unknown>)[] = [];

  /** Default rows a new society starts with. */
  onSocietyCreated(hook: (tx: Tx, societyId: string) => Promise<unknown>): void {
    this.societyCreatedHooks.push(hook);
  }

  /**
   * A membership ended (admin set it to LEFT, or the account was deleted): release the
   * member's work in that one society (tasks, duty turns, listings and open orders).
   */
  onMemberLeft(hook: (tx: Tx, e: MemberLeft) => Promise<unknown>): void {
    this.memberLeftHooks.push(hook);
  }

  /** Account-wide clean-up beyond what each membership's onMemberLeft already does. */
  onAccountDeleted(hook: (tx: Tx, e: AccountDeleted) => Promise<unknown>): void {
    this.accountDeletedHooks.push(hook);
  }

  async societyCreated(tx: Tx, societyId: string): Promise<void> {
    for (const hook of this.societyCreatedHooks) await hook(tx, societyId);
  }

  async memberLeft(tx: Tx, e: MemberLeft): Promise<void> {
    for (const hook of this.memberLeftHooks) await hook(tx, e);
  }

  /** Runs onMemberLeft for every membership of the account, then the account-wide hooks. */
  async accountDeleted(tx: Tx, e: AccountDeleted): Promise<void> {
    for (const m of e.memberships)
      await this.memberLeft(tx, {
        membershipId: m.id,
        societyId: m.societyId,
        userId: e.userId,
        reason: 'account-deleted',
      });
    for (const hook of this.accountDeletedHooks) await hook(tx, e);
  }
}

@Global()
@Module({ providers: [Lifecycle], exports: [Lifecycle] })
export class LifecycleModule {}
