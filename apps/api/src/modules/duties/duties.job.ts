import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { withJobLock } from '../../common/jobs/job-lock';
import { PrismaService } from '../../common/prisma/prisma.service';
import { addDays, dateOnly, dbDate, todayIn } from '../../common/util/dates';
import {
  type AssignmentRow,
  type DutyWithParticipants,
  participantIdOf,
  plan,
  replan,
  withParticipants,
} from './duty-plan';
import { DutyTurns } from './duty-turns.service';

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
   * starts turns whose day has come, and reminds 2 days before a turn ends.
   */
  async advance(now: Date): Promise<number> {
    const duties = await this.prisma.responsibility.findMany({
      where: { status: 'ACTIVE', society: { status: 'ACTIVE' } },
      include: { ...withParticipants, society: { include: { modules: true } } },
    });
    let changes = 0;
    for (const duty of duties) {
      const mod = duty.society.modules.find((m) => m.moduleKey === 'responsibilities');
      if (mod && !mod.enabled) continue;
      const today = todayIn(duty.society.timezone, now);
      const missed: AssignmentRow[] = [];
      await this.prisma.$transaction(async (tx) => {
        const due = await tx.responsibilityAssignment.findMany({
          where: {
            responsibilityId: duty.id,
            status: { in: ['UPCOMING', 'ACTIVE'] },
            periodEnd: { lt: dbDate(today) },
          },
          orderBy: { periodIndex: 'asc' },
        });
        let carry: string | undefined;
        for (const r of due) {
          const isMissed = duty.requiresConfirmation && r.confirmedAt === null;
          await tx.responsibilityAssignment.update({
            where: { id: r.id },
            data: { status: isMissed ? 'MISSED' : 'COMPLETED' },
          });
          if (isMissed) {
            missed.push(r);
            if (duty.onMiss === 'CARRY_OVER') carry = participantIdOf(r);
          }
          changes += 1;
        }
        if (carry) await replan(tx, duty, today, carry);
        else await plan(tx, duty, today);
      });
      for (const r of missed)
        await this.turns.tell(duty, participantIdOf(r), 'missed', dateOnly(r.periodEnd));
      changes += await this.turns.activate(duty, today);
      await this.remind(duty, today);
    }
    if (changes > 0) this.logger.log(`duty turns changed: ${changes}`);
    return changes;
  }

  private async remind(duty: DutyWithParticipants, today: string) {
    if (!duty.requiresConfirmation) return;
    const rows = await this.prisma.responsibilityAssignment.findMany({
      where: {
        responsibilityId: duty.id,
        status: 'ACTIVE',
        confirmedAt: null,
        periodEnd: { lte: dbDate(addDays(today, 2)) },
      },
    });
    for (const r of rows) {
      const { count } = await this.prisma.reminderSent.createMany({
        data: [
          { societyId: duty.societyId, entityType: 'DutyTurn', entityId: r.id, kind: 'confirm-2d' },
        ],
        skipDuplicates: true,
      });
      if (count > 0)
        await this.turns.tell(duty, participantIdOf(r), 'remind', dateOnly(r.periodEnd));
    }
  }
}
