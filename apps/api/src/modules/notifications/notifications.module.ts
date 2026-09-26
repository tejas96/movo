import { Module } from '@nestjs/common';
import { DeliveryJob } from './delivery.job';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NoopPushTransport, PushTransport } from './push.transport';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    DeliveryJob,
    { provide: PushTransport, useClass: NoopPushTransport },
  ],
  exports: [NotificationsService, DeliveryJob],
})
export class NotificationsModule {}
