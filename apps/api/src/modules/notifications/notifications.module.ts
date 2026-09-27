import { Logger, Module } from '@nestjs/common';
import { loadEnv } from '../../config/env';
import { DeliveryJob } from './delivery.job';
import { FcmPushTransport, parseServiceAccount } from './fcm.transport';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NoopPushTransport, PushTransport } from './push.transport';

/** FCM when FIREBASE_SERVICE_ACCOUNT_JSON holds a service account, else log-only. Decided at boot. */
function pushTransportFactory(): PushTransport {
  const raw = loadEnv().FIREBASE_SERVICE_ACCOUNT_JSON;
  const account = parseServiceAccount(raw);
  const logger = new Logger('Push');
  if (account) {
    logger.log(`FCM push enabled for project ${account.project_id}`);
    return new FcmPushTransport(account);
  }
  if (raw.trim())
    logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON is set but not a service account JSON');
  logger.log('push not configured; deliveries are logged and skipped');
  return new NoopPushTransport();
}

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    DeliveryJob,
    { provide: PushTransport, useFactory: pushTransportFactory },
  ],
  exports: [NotificationsService, DeliveryJob],
})
export class NotificationsModule {}
