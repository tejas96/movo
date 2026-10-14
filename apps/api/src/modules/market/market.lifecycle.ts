import type { MemberLeft } from '../../common/lifecycle/lifecycle';
import type { Prisma } from '../../generated/prisma/client';
import { OPEN_ORDER } from './order-state';

/** Membership ended: the member's listings in that society go, open orders on either side are cancelled. */
export async function closeMarketForLeaver(
  tx: Prisma.TransactionClient,
  e: MemberLeft,
): Promise<void> {
  const mid = e.membershipId;
  await tx.listing.updateMany({
    where: { societyId: e.societyId, sellerMembershipId: mid, status: { not: 'ARCHIVED' } },
    data: { status: 'ARCHIVED' },
  });
  await tx.marketOrder.updateMany({
    where: {
      societyId: e.societyId,
      OR: [{ buyerMembershipId: mid }, { sellerMembershipId: mid }],
      status: { in: [...OPEN_ORDER] },
    },
    data: {
      status: 'CANCELLED',
      reason: e.reason === 'account-deleted' ? 'account deleted' : 'member left',
      closedAt: new Date(),
    },
  });
}
