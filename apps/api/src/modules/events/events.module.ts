import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService, AuditService],
  exports: [EventsService],
})
export class EventsModule {}
