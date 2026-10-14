import type { AccountDeleted } from '../../common/lifecycle/lifecycle';
import type { Prisma } from '../../generated/prisma/client';
import { OPEN_ORDER } from './order-state';

/** Account deleted: the user's listings go, open orders on either side are cancelled. */
export async function closeMarketForDeletedAccount(
  tx: Prisma.TransactionClient,
  e: AccountDeleted,
): Promise<void> {
  const mids = e.membershipIds;
  await tx.listing.updateMany({
    where: { sellerMembershipId: { in: mids }, status: { not: 'ARCHIVED' } },
    data: { status: 'ARCHIVED' },
  });
  await tx.marketOrder.updateMany({
    where: {
      OR: [{ buyerMembershipId: { in: mids } }, { sellerMembershipId: { in: mids } }],
      status: { in: [...OPEN_ORDER] },
    },
    data: { status: 'CANCELLED', reason: 'account deleted', closedAt: new Date() },
  });
}
