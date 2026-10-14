import { Module, type OnModuleInit } from '@nestjs/common';
import { Lifecycle } from '../../common/lifecycle/lifecycle';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ListingsService } from './listings.service';
import { MarketController } from './market.controller';
import { closeMarketForDeletedAccount } from './market.lifecycle';
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
  constructor(private readonly lifecycle: Lifecycle) {}

  onModuleInit(): void {
    this.lifecycle.onAccountDeleted(closeMarketForDeletedAccount);
  }
}
