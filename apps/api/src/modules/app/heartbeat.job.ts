import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { loadEnv } from '../../config/env';

/**
 * Uptime heartbeat. Every 5 minutes, when UPTIME_HEARTBEAT_URL is set (a healthchecks.io ping
 * URL), checks that the database answers and then GETs the URL. When pings stop (server, API
 * or database down), healthchecks.io emails you. Empty URL = does nothing. Never throws.
 */
@Injectable()
export class HeartbeatJob {
  private readonly logger = new Logger(HeartbeatJob.name);
  private readonly url = loadEnv().UPTIME_HEARTBEAT_URL;

  constructor(private readonly prisma: PrismaService) {}

  @Interval(5 * 60_000)
  async tick(): Promise<void> {
    if (!this.url) return;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const res = await fetch(this.url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) this.logger.debug(`uptime heartbeat answered ${res.status}`);
    } catch (error) {
      this.logger.debug(
        `uptime heartbeat skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
