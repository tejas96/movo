import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { withJobLock } from '../../common/jobs/job-lock';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BillsService } from './bills.service';

const TZ = 'Asia/Kolkata';

/** Nightly billing work. Each step is safe to run twice. */
@Injectable()
export class MaintenanceJob {
  private readonly logger = new Logger(MaintenanceJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bills: BillsService,
  ) {}

  @Cron('30 0 * * *', { timeZone: TZ })
  generate(): Promise<void> {
    return this.locked('movo:bills:generate', () => this.generateAll(new Date()));
  }

  @Cron('0 1 * * *', { timeZone: TZ })
  lateFees(): Promise<void> {
    return this.locked('movo:bills:late-fees', () => this.bills.applyLateFees(new Date()));
  }

  @Cron('0 9 * * *', { timeZone: TZ })
  reminders(): Promise<void> {
    return this.locked('movo:bills:reminders', () => this.bills.sendDuesReminders(new Date()));
  }

  async generateAll(now: Date): Promise<number> {
    const societies = await this.prisma.society.findMany({
      where: { status: 'ACTIVE', billingPlans: { some: { isActive: true } } },
      select: { id: true },
    });
    let created = 0;
    for (const s of societies) created += (await this.bills.generateForSociety(s.id, now)).created;
    if (created > 0) this.logger.log(`generated ${created} bill(s)`);
    return created;
  }

  private async locked(name: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      await withJobLock(this.prisma, name, fn);
    } catch (error) {
      this.logger.error(
        `${name} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
