import type { AuditService } from '../../common/audit/audit.service';
import type { MemberLeft } from '../../common/lifecycle/lifecycle';
import { todayIn } from '../../common/util/dates';
import { participantIdOf, replaceParticipants, type Tx, withParticipants } from './duty-plan';

/** Shown on the skipped turn, like "Duty ended" when a duty ends mid-turn. */
const NOTE = { left: 'Member left', 'account-deleted': 'Account deleted' } as const;

/**
 * Membership ended (set to LEFT, or account deleted): the member leaves every member rotation
 * they were in, in that society. Their running turn is
 * skipped the way a committee "Skip" does it (SKIPPED + note, duty.overridden audit), then the
 * rest are kept in order and future turns are planned again, as when the committee edits the
 * participant list (duty.participants.updated audit). Flat rotations are not touched: the
 * flat stays. Nobody is notified, as with those two paths.
 */
export function leaveDutiesOnMemberLeft(audit: AuditService) {
  return async (tx: Tx, e: MemberLeft): Promise<void> => {
    const note = NOTE[e.reason ?? 'left'];
    const duties = await tx.responsibility.findMany({
      where: {
        societyId: e.societyId,
        participantKind: 'MEMBER',
        status: { not: 'ENDED' },
        participants: { some: { membershipId: e.membershipId } },
      },
      include: { ...withParticipants, society: { select: { timezone: true } } },
    });
    for (const duty of duties) {
      const running = await tx.responsibilityAssignment.findMany({
        where: {
          responsibilityId: duty.id,
          status: 'ACTIVE',
          membershipId: e.membershipId,
        },
      });
      for (const turn of running) {
        await tx.responsibilityAssignment.update({
          where: { id: turn.id },
          data: { status: 'SKIPPED', overrideNote: note },
        });
        await audit.record(
          {
            action: 'duty.overridden',
            entityType: 'ResponsibilityAssignment',
            entityId: turn.id,
            societyId: duty.societyId,
            before: { status: turn.status, participant: participantIdOf(turn) },
            after: { action: 'SKIP', participant: null, reason: note },
          },
          tx,
        );
      }
      const ids = duty.participants.map(participantIdOf).filter((id) => id !== e.membershipId);
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
