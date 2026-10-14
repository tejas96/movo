import { Module, type OnModuleInit } from '@nestjs/common';
import { Lifecycle } from '../../common/lifecycle/lifecycle';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MarketController } from './market.controller';
import { closeMarketForDeletedAccount, MarketService } from './market.service';

@Module({
  imports: [FilesModule, NotificationsModule],
  controllers: [MarketController],
  providers: [MarketService],
  exports: [MarketService],
})
export class MarketModule implements OnModuleInit {
  constructor(private readonly lifecycle: Lifecycle) {}

  onModuleInit(): void {
    this.lifecycle.onAccountDeleted(closeMarketForDeletedAccount);
  }
}
