import { Module, type OnModuleInit } from '@nestjs/common';
import { HOME_ORDER, HomeRegistry } from '../../common/home/home-registry';
import { Lifecycle } from '../../common/lifecycle/lifecycle';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ListingsService } from './listings.service';
import { MarketController } from './market.controller';
import { closeMarketForLeaver } from './market.lifecycle';
import { MarketViews } from './market-views.service';
import { ModerationService } from './moderation.service';
import { OrdersService } from './orders.service';

@Module({
  imports: [FilesModule, NotificationsModule],
  controllers: [MarketController],
  providers: [MarketViews, ListingsService, ModerationService, OrdersService],
  exports: [OrdersService],
})
export class MarketModule implements OnModuleInit {
  constructor(
    private readonly lifecycle: Lifecycle,
    private readonly home: HomeRegistry,
    private readonly orders: OrdersService,
  ) {}

  onModuleInit(): void {
    this.lifecycle.onMemberLeft(closeMarketForLeaver);
    this.home.register({
      module: 'marketplace',
      order: HOME_ORDER.marketplace,
      load: async (ctx) => {
        const waiting = await this.orders.waitingCount(ctx.membershipId);
        return {
          attention: waiting > 0 ? [{ type: 'MARKET_ORDERS_WAITING', count: waiting }] : [],
        };
      },
    });
  }
}
