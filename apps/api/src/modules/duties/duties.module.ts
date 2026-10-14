import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DutiesController } from './duties.controller';
import { DutiesJob } from './duties.job';
import { DutiesService } from './duties.service';

@Module({
  imports: [NotificationsModule],
  controllers: [DutiesController],
  providers: [DutiesService, DutiesJob],
  exports: [DutiesService],
})
export class DutiesModule {}
