import { Module } from '@nestjs/common';
import { NoticesModule } from '../notices/notices.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [NoticesModule, NotificationsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
