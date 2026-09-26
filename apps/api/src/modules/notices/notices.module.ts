import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';

@Module({
  imports: [NotificationsModule],
  controllers: [NoticesController],
  providers: [NoticesService, AuditService],
  exports: [NoticesService],
})
export class NoticesModule {}
