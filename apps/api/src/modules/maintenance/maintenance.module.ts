import { Module, type OnModuleInit } from '@nestjs/common';
import { HOME_ORDER, HomeRegistry } from '../../common/home/home-registry';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountsService } from './accounts.service';
import { BillsService } from './bills.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceJob } from './maintenance.job';
import { PaymentsService } from './payments.service';
import { PlansService } from './plans.service';

@Module({
  imports: [NotificationsModule, FilesModule],
  controllers: [MaintenanceController],
  providers: [AccountsService, BillsService, PaymentsService, PlansService, MaintenanceJob],
  exports: [AccountsService, MaintenanceJob, BillsService],
})
export class MaintenanceModule implements OnModuleInit {
  constructor(
    private readonly home: HomeRegistry,
    private readonly accounts: AccountsService,
  ) {}

  onModuleInit(): void {
    this.home.register({
      module: 'maintenance',
      order: HOME_ORDER.maintenance,
      load: async (ctx) => ({ attention: await this.accounts.attentionForHome(ctx) }),
    });
  }
}
