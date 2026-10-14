import { dateOnly, dbDate } from '../../common/util/dates';
import type {
  ResponsibilityAssignment as AssignmentRow,
  Responsibility as DutyRow,
  ResponsibilityParticipant as ParticipantRow,
  Prisma,
} from '../../generated/prisma/client';
import {
  type Cadence,
  PLAN_AHEAD,
  periodEnd,
  periodIndexFor,
  periodStart,
  rotate,
} from './rotation';

/** Turn planning on top of the pure rotation rules, shared by the API, the job and hooks. */

export type Tx = Prisma.TransactionClient;
export type { AssignmentRow, DutyRow };
export type DutyWithParticipants = DutyRow & { participants: ParticipantRow[] };

export const withParticipants = { participants: { orderBy: { position: 'asc' } } } as const;

const cadenceOf = (d: DutyRow): Cadence => ({
  startDate: dateOnly(d.startDate),
  unit: d.periodUnit,
  length: d.periodLength,
});
export const participantIdOf = (r: { flatId: string | null; membershipId: string | null }) =>
  (r.flatId ?? r.membershipId) as string;
export const participantData = (kind: DutyRow['participantKind'], id: string) =>
  kind === 'FLAT' ? { flatId: id, membershipId: null } : { flatId: null, membershipId: id };

/**
 * Makes sure turns exist up to PLAN_AHEAD periods from today, continuing the order after the
 * last planned turn. `carry` puts that participant first (a missed turn carried over).
 */
export async function plan(tx: Tx, duty: DutyWithParticipants, today: string, carry?: string) {
  const cadence = cadenceOf(duty);
  const ids = duty.participants.map(participantIdOf);
  if (ids.length === 0) return;
  const last = await tx.responsibilityAssignment.findFirst({
    where: { responsibilityId: duty.id },
    orderBy: { periodIndex: 'desc' },
  });
  const current = Math.max(0, periodIndexFor(cadence, today));
  const first = Math.max(last ? last.periodIndex + 1 : 0, current);
  const count = current + PLAN_AHEAD - first;
  if (count <= 0) return;
  const order = carry
    ? [carry, ...rotate(ids, carry, count - 1)]
    : rotate(ids, last ? participantIdOf(last) : null, count);
  await tx.responsibilityAssignment.createMany({
    data: order.map((pid, i) => ({
      societyId: duty.societyId,
      responsibilityId: duty.id,
      periodIndex: first + i,
      periodStart: dbDate(periodStart(cadence, first + i)),
      periodEnd: dbDate(periodEnd(cadence, first + i)),
      ...participantData(duty.participantKind, pid),
      status: 'UPCOMING' as const,
    })),
  });
}

/** Turns not over yet, plus the one whose period holds today whatever its status. */
export function liveWhere(today: Date): Prisma.ResponsibilityAssignmentWhereInput {
  return {
    OR: [
      { status: { in: ['ACTIVE', 'UPCOMING'] } },
      { periodStart: { lte: today }, periodEnd: { gte: today } },
    ],
  };
}

/** The ACTIVE turn, else this period's turn once it is done or skipped. None for an ended duty. */
export function currentTurn(d: DutyRow, rows: AssignmentRow[]): AssignmentRow | undefined {
  if (d.status === 'ENDED') return undefined;
  return rows.find((r) => r.status === 'ACTIVE') ?? rows.find((r) => r.status !== 'UPCOMING');
}

/** Whether plan() would add turns, given the duty's highest planned periodIndex (null = none). */
export function needsPlanning(duty: DutyWithParticipants, lastIndex: number | null, today: string) {
  if (duty.participants.length === 0) return false;
  const current = Math.max(0, periodIndexFor(cadenceOf(duty), today));
  const first = Math.max(lastIndex === null ? 0 : lastIndex + 1, current);
  return current + PLAN_AHEAD - first > 0;
}

/** Drops turns that have not started and plans them again. */
export async function replan(tx: Tx, duty: DutyWithParticipants, today: string, carry?: string) {
  await tx.responsibilityAssignment.deleteMany({
    where: { responsibilityId: duty.id, status: 'UPCOMING' },
  });
  await plan(tx, duty, today, carry);
}

/** Puts `ids` in as the duty's participants, in this order, and replans an active duty. */
export async function replaceParticipants(tx: Tx, duty: DutyRow, ids: string[], today: string) {
  await tx.responsibilityParticipant.deleteMany({ where: { responsibilityId: duty.id } });
  await tx.responsibilityParticipant.createMany({
    data: ids.map((id, position) => ({
      societyId: duty.societyId,
      responsibilityId: duty.id,
      position,
      ...participantData(duty.participantKind, id),
    })),
  });
  const fresh = await tx.responsibility.findUniqueOrThrow({
    where: { id: duty.id },
    include: withParticipants,
  });
  if (fresh.status === 'ACTIVE') await replan(tx, fresh, today);
}
