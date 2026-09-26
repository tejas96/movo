import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { withJobLock } from '../../common/jobs/job-lock';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FilesService } from './files.service';

/** Nightly at 03:15 IST: uploads nobody used. */
@Injectable()
export class FilesJob {
  private readonly logger = new Logger(FilesJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  @Cron('15 3 * * *', { timeZone: 'Asia/Kolkata' })
  async tick(): Promise<void> {
    try {
      await withJobLock(this.prisma, 'movo:files', () => this.files.removeUnused());
    } catch (error) {
      this.logger.error(
        `files cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
