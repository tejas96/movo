import { Module } from '@nestjs/common';
import { EmergencyModule } from '../emergency/emergency.module';
import { NoticesModule } from '../notices/notices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VendorsModule } from '../vendors/vendors.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [NoticesModule, NotificationsModule, EmergencyModule, VendorsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
