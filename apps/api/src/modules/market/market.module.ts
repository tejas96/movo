import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';

@Module({
  imports: [FilesModule, NotificationsModule],
  controllers: [MarketController],
  providers: [MarketService, AuditService],
  exports: [MarketService],
})
export class MarketModule {}
