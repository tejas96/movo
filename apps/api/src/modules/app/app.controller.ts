import { type AppConfig, appContract } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Route } from '../../common/route/route.decorator';
import { loadEnv } from '../../config/env';

@Controller()
export class AppController {
  @Route(appContract.health)
  health(): { status: 'ok'; version: string; time: string } {
    return {
      status: 'ok',
      version: process.env.npm_package_version ?? '0.0.1',
      time: new Date().toISOString(),
    };
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
