import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountsService } from './accounts.service';
import { BillsService } from './bills.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceJob } from './maintenance.job';
import { PaymentsService } from './payments.service';
import { PlansService } from './plans.service';

@Module({
  imports: [NotificationsModule],
  controllers: [MaintenanceController],
  providers: [
    AccountsService,
    BillsService,
    PaymentsService,
    PlansService,
    MaintenanceJob,
    AuditService,
  ],
  exports: [AccountsService, MaintenanceJob, BillsService],
})
export class MaintenanceModule {}
