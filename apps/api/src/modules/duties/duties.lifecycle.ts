import type { AuditService } from '../../common/audit/audit.service';
import type { AccountDeleted } from '../../common/lifecycle/lifecycle';
import { todayIn } from '../../common/util/dates';
import { participantIdOf, replaceParticipants, type Tx, withParticipants } from './duty-plan';

/** Shown on the skipped turn, like "Duty ended" when a duty ends mid-turn. */
const ACCOUNT_DELETED_NOTE = 'Account deleted';

/**
 * Account deleted: the user leaves every member rotation they were in. Their running turn is
 * skipped the way a committee "Skip" does it (SKIPPED + note, duty.overridden audit), then the
 * rest are kept in order and future turns are planned again, as when the committee edits the
 * participant list (duty.participants.updated audit). Flat rotations are not touched: the
 * flat stays. Nobody is notified, as with those two paths.
 */
export function leaveDutiesOnAccountDeleted(audit: AuditService) {
  return async (tx: Tx, e: AccountDeleted): Promise<void> => {
    const gone = new Set(e.membershipIds);
    const duties = await tx.responsibility.findMany({
      where: {
        participantKind: 'MEMBER',
        status: { not: 'ENDED' },
        participants: { some: { membershipId: { in: e.membershipIds } } },
      },
      include: { ...withParticipants, society: { select: { timezone: true } } },
    });
    for (const duty of duties) {
      const running = await tx.responsibilityAssignment.findMany({
        where: {
          responsibilityId: duty.id,
          status: 'ACTIVE',
          membershipId: { in: e.membershipIds },
        },
      });
      for (const turn of running) {
        await tx.responsibilityAssignment.update({
          where: { id: turn.id },
          data: { status: 'SKIPPED', overrideNote: ACCOUNT_DELETED_NOTE },
        });
        await audit.record(
          {
            action: 'duty.overridden',
            entityType: 'ResponsibilityAssignment',
            entityId: turn.id,
            societyId: duty.societyId,
            before: { status: turn.status, participant: participantIdOf(turn) },
            after: { action: 'SKIP', participant: null, reason: ACCOUNT_DELETED_NOTE },
          },
          tx,
        );
      }
      const ids = duty.participants.map(participantIdOf).filter((id) => !gone.has(id));
      await replaceParticipants(tx, duty, ids, todayIn(duty.society.timezone));
      await audit.record(
        {
          action: 'duty.participants.updated',
          entityType: 'Responsibility',
          entityId: duty.id,
          societyId: duty.societyId,
          after: { participants: ids.length },
        },
        tx,
      );
    }
  };
}
