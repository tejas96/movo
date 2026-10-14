import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

/** Feature modules add their parts through HomeRegistry; Home imports none of them. */
@Module({
  imports: [NotificationsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
