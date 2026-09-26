import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { withJobLock } from '../../common/jobs/job-lock';
import { PrismaService } from '../../common/prisma/prisma.service';
import { minutes } from '../../common/util/dates';
import { EventsService } from '../events/events.service';
import { MeetingsService } from '../meetings/meetings.service';

/** Every 5 minutes: meeting and event reminders. ReminderSent rows stop duplicates. */
@Injectable()
export class RemindersJob {
  private readonly logger = new Logger(RemindersJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meetings: MeetingsService,
    private readonly events: EventsService,
  ) {}

  @Interval(minutes(5))
  async tick(): Promise<void> {
    try {
      await withJobLock(this.prisma, 'movo:reminders', () => this.run(new Date()));
    } catch (error) {
      this.logger.error(
        `reminder tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async run(now: Date): Promise<number> {
    return (await this.meetings.sendDueReminders(now)) + (await this.events.sendDueReminders(now));
  }
}
