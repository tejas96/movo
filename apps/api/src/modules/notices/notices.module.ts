import { Module, type OnModuleInit } from '@nestjs/common';
import { HOME_ORDER, HomeRegistry } from '../../common/home/home-registry';
import { NotificationsModule } from '../notifications/notifications.module';
import { NoticesController } from './notices.controller';
import { NoticesService } from './notices.service';

@Module({
  imports: [NotificationsModule],
  controllers: [NoticesController],
  providers: [NoticesService],
  exports: [NoticesService],
})
export class NoticesModule implements OnModuleInit {
  constructor(
    private readonly home: HomeRegistry,
    private readonly notices: NoticesService,
  ) {}

  onModuleInit(): void {
    this.home.register({
      module: 'notices',
      order: HOME_ORDER.notices,
      load: async (ctx) => {
        const { notices, unreadImportant } = await this.notices.forHome(ctx, 3);
        // Newest first from the service; the older of the two shows on top.
        const attention = unreadImportant
          .slice(0, 2)
          .reverse()
          .map((n) => ({
            type: 'IMPORTANT_NOTICE' as const,
            noticeId: n.id,
            title: n.title,
            priority: n.priority === 'EMERGENCY' ? ('EMERGENCY' as const) : ('IMPORTANT' as const),
          }));
        return { notices, attention };
      },
    });
  }
}
