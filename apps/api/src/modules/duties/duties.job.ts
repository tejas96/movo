import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { withJobLock } from '../../common/jobs/job-lock';
import { PrismaService } from '../../common/prisma/prisma.service';
import { addDays, dateOnly, dbDate, todayIn } from '../../common/util/dates';
import {
  type DutyWithParticipants,
  needsPlanning,
  participantIdOf,
  plan,
  replan,
  type Tx,
  withParticipants,
} from './duty-plan';
import { DutyTurns, type Tell } from './duty-turns.service';

/** Hourly: turns start, end, carry over and get reminders. */
@Injectable()
export class DutiesJob {
  private readonly logger = new Logger(DutiesJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly turns: DutyTurns,
  ) {}

  @Cron('5 * * * *')
  async tick(): Promise<void> {
    try {
      await withJobLock(this.prisma, 'movo:duties', () => this.advance(new Date()));
    } catch (error) {
      this.logger.error(
        `duties tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Hourly job, all societies: closes finished turns (missed when confirmation was needed and
   * not given), carries a missed turn over when the duty says so, keeps 12 turns planned,
   * starts turns whose day has come, and reminds 2 days before a turn ends. One transaction
   * per society, with each step a single query over all its duties.
   */
  async advance(now: Date): Promise<number> {
    const duties = await this.prisma.responsibility.findMany({
      where: { status: 'ACTIVE', society: { status: 'ACTIVE' } },
      include: {
        ...withParticipants,
        society: { include: { modules: { where: { moduleKey: 'responsibilities' } } } },
      },
    });
    const bySociety = new Map<string, typeof duties>();
    for (const d of duties) bySociety.set(d.societyId, [...(bySociety.get(d.societyId) ?? []), d]);
    let changes = 0;
    for (const list of bySociety.values()) {
      const society = list[0]?.society;
      if (!society || (society.modules[0] && !society.modules[0].enabled)) continue;
      const today = todayIn(society.timezone, now);
      changes += await this.prisma.$transaction((tx) => this.advanceSociety(tx, list, today), {
        timeout: 60_000,
      });
    }
    if (changes > 0) this.logger.log(`duty turns changed: ${changes}`);
    return changes;
  }

  private async advanceSociety(
    tx: Tx,
    duties: DutyWithParticipants[],
    today: string,
  ): Promise<number> {
    const ids = duties.map((d) => d.id);
    const byId = new Map(duties.map((d) => [d.id, d]));
    const pushes: Tell[] = [];
    let changes = 0;

    // 1. Turns whose period is over: done, or missed when confirmation was needed.
    const due = await tx.responsibilityAssignment.findMany({
      where: {
        responsibilityId: { in: ids },
        status: { in: ['UPCOMING', 'ACTIVE'] },
        periodEnd: { lt: dbDate(today) },
      },
      orderBy: { periodIndex: 'asc' },
    });
    const missed: string[] = [];
    const completed: string[] = [];
    const carry = new Map<string, string>();
    for (const r of due) {
      const duty = byId.get(r.responsibilityId) as DutyWithParticipants;
      if (duty.requiresConfirmation && r.confirmedAt === null) {
        missed.push(r.id);
        const pid = participantIdOf(r);
        pushes.push({ duty, participantId: pid, kind: 'missed', endDate: dateOnly(r.periodEnd) });
        if (duty.onMiss === 'CARRY_OVER') carry.set(duty.id, pid);
      } else completed.push(r.id);
    }
    if (missed.length > 0)
      await tx.responsibilityAssignment.updateMany({
        where: { id: { in: missed } },
        data: { status: 'MISSED' },
      });
    if (completed.length > 0)
      await tx.responsibilityAssignment.updateMany({
        where: { id: { in: completed } },
        data: { status: 'COMPLETED' },
      });
    changes += due.length;

    // 2. Keep 12 turns planned; a missed turn carried over goes first.
    const last = await tx.responsibilityAssignment.groupBy({
      by: ['responsibilityId'],
      where: { responsibilityId: { in: ids } },
      _max: { periodIndex: true },
    });
    const lastIndex = new Map(last.map((g) => [g.responsibilityId, g._max.periodIndex]));
    for (const duty of duties) {
      const carried = carry.get(duty.id);
      if (carried) await replan(tx, duty, today, carried);
      else if (needsPlanning(duty, lastIndex.get(duty.id) ?? null, today))
        await plan(tx, duty, today);
    }

    // 3. Start turns whose first day has come.
    const starting = await tx.responsibilityAssignment.findMany({
      where: {
        responsibilityId: { in: ids },
        status: 'UPCOMING',
        periodStart: { lte: dbDate(today) },
      },
    });
    if (starting.length > 0) {
      await tx.responsibilityAssignment.updateMany({
        where: { id: { in: starting.map((r) => r.id) } },
        data: { status: 'ACTIVE' },
      });
      for (const r of starting)
        pushes.push({
          duty: byId.get(r.responsibilityId) as DutyWithParticipants,
          participantId: participantIdOf(r),
          kind: 'start',
          endDate: dateOnly(r.periodEnd),
        });
      changes += starting.length;
    }

    // 4. Remind 2 days before an unconfirmed turn ends, once per turn.
    const confirmIds = duties.filter((d) => d.requiresConfirmation).map((d) => d.id);
    const ending = confirmIds.length
      ? await tx.responsibilityAssignment.findMany({
          where: {
            responsibilityId: { in: confirmIds },
            status: 'ACTIVE',
            confirmedAt: null,
            periodEnd: { lte: dbDate(addDays(today, 2)) },
          },
        })
      : [];
    if (ending.length > 0) {
      const sent = new Set(
        (
          await tx.reminderSent.findMany({
            where: {
              entityType: 'DutyTurn',
              entityId: { in: ending.map((r) => r.id) },
              kind: 'confirm-2d',
            },
            select: { entityId: true },
          })
        ).map((r) => r.entityId),
      );
      const fresh = ending.filter((r) => !sent.has(r.id));
      if (fresh.length > 0) {
        await tx.reminderSent.createMany({
          data: fresh.map((r) => ({
            societyId: r.societyId,
            entityType: 'DutyTurn',
            entityId: r.id,
            kind: 'confirm-2d',
          })),
          skipDuplicates: true,
        });
        for (const r of fresh)
          pushes.push({
            duty: byId.get(r.responsibilityId) as DutyWithParticipants,
            participantId: participantIdOf(r),
            kind: 'remind',
            endDate: dateOnly(r.periodEnd),
          });
      }
    }

    await this.turns.tellMany(pushes, tx);
    return changes;
  }
}
