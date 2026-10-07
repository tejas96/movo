import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { ReportService } from './report.service';

@Module({
  imports: [NotificationsModule, FilesModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, ReportService, AuditService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
