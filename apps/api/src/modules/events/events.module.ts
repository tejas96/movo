import { Module, type OnModuleInit } from '@nestjs/common';
import { HOME_ORDER, HomeRegistry } from '../../common/home/home-registry';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [NotificationsModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule implements OnModuleInit {
  constructor(
    private readonly home: HomeRegistry,
    private readonly events: EventsService,
  ) {}

  onModuleInit(): void {
    this.home.register({
      module: 'events',
      order: HOME_ORDER.events,
      load: async (ctx, now) => ({ upcoming: await this.events.forHome(ctx, now) }),
    });
  }
}
