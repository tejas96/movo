import { Module } from '@nestjs/common';
import { DutiesModule } from '../duties/duties.module';
import { EmergencyModule } from '../emergency/emergency.module';
import { EventsModule } from '../events/events.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { NoticesModule } from '../notices/notices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RewardsModule } from '../rewards/rewards.module';
import { TasksModule } from '../tasks/tasks.module';
import { VendorsModule } from '../vendors/vendors.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [
    NoticesModule,
    NotificationsModule,
    EmergencyModule,
    VendorsModule,
    MeetingsModule,
    EventsModule,
    MaintenanceModule,
    ExpensesModule,
    DutiesModule,
    TasksModule,
    RewardsModule,
  ],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
