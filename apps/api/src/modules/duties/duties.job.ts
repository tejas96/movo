import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { withJobLock } from '../../common/jobs/job-lock';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DutiesService } from './duties.service';

/** Hourly: turns start, end, carry over and get reminders. */
@Injectable()
export class DutiesJob {
  private readonly logger = new Logger(DutiesJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly duties: DutiesService,
  ) {}

  @Cron('5 * * * *')
  async tick(): Promise<void> {
    try {
      await withJobLock(this.prisma, 'movo:duties', () => this.duties.advance(new Date()));
    } catch (error) {
      this.logger.error(
        `duties tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
