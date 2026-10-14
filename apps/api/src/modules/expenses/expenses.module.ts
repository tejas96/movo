import { Module, type OnModuleInit } from '@nestjs/common';
import { Lifecycle } from '../../common/lifecycle/lifecycle';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExpensesController } from './expenses.controller';
import { defaultExpenseCategoryRows, ExpensesService } from './expenses.service';
import { ReportService } from './report.service';

@Module({
  imports: [NotificationsModule, FilesModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, ReportService],
  exports: [ExpensesService],
})
export class ExpensesModule implements OnModuleInit {
  constructor(private readonly lifecycle: Lifecycle) {}

  onModuleInit(): void {
    this.lifecycle.onSocietyCreated((tx, societyId) =>
      tx.expenseCategory.createMany({ data: defaultExpenseCategoryRows(societyId) }),
    );
  }
}
