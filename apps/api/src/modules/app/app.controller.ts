import { type AppConfig, appContract } from '@movo/contracts';
import { Controller, HttpStatus } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Route } from '../../common/route/route.decorator';
import { loadEnv } from '../../config/env';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Healthy only when the database answers, so the Docker health check and the deploy gate
   * catch a broken database too. version is the git commit the image was built from.
   */
  @Route(appContract.health)
  async health(): Promise<{ status: 'ok'; version: string; time: string }> {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3_000)),
      ]);
    } catch {
      throw new ApiException(
        'INTERNAL',
        'Database is not answering',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ok', version: loadEnv().APP_VERSION, time: new Date().toISOString() };
  }

  @Route(appContract.config)
  config(): AppConfig {
    const env = loadEnv();
    return {
      minSupportedVersion: env.MIN_SUPPORTED_APP_VERSION,
      latestVersion: env.LATEST_APP_VERSION,
      supportEmail: env.SUPPORT_EMAIL || null,
      privacyPolicyUrl: env.PRIVACY_POLICY_URL || null,
    };
  }
}
