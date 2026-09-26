import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmergencyController } from './emergency.controller';
import { EmergencyService } from './emergency.service';

@Module({
  imports: [NotificationsModule],
  controllers: [EmergencyController],
  providers: [EmergencyService, AuditService],
  exports: [EmergencyService],
})
export class EmergencyModule {}
