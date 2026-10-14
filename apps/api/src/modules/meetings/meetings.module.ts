import { Module, type OnModuleInit } from '@nestjs/common';
import { HOME_ORDER, HomeRegistry } from '../../common/home/home-registry';
import { NotificationsModule } from '../notifications/notifications.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';

@Module({
  imports: [NotificationsModule],
  controllers: [MeetingsController],
  providers: [MeetingsService],
  exports: [MeetingsService],
})
export class MeetingsModule implements OnModuleInit {
  constructor(
    private readonly home: HomeRegistry,
    private readonly meetings: MeetingsService,
  ) {}

  onModuleInit(): void {
    this.home.register({
      module: 'meetings',
      order: HOME_ORDER.meetings,
      load: async (ctx, now) => ({ upcoming: await this.meetings.forHome(ctx, now) }),
    });
  }
}
