import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DutiesController } from './duties.controller';
import { DutiesJob } from './duties.job';
import { DutiesService } from './duties.service';
import { DutyTurns } from './duty-turns.service';

@Module({
  imports: [NotificationsModule],
  controllers: [DutiesController],
  providers: [DutiesService, DutyTurns, DutiesJob],
  exports: [DutiesService],
})
export class DutiesModule {}
