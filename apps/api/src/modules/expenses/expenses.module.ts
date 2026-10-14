import { Module, type OnModuleInit } from '@nestjs/common';
import { Lifecycle } from '../../common/lifecycle/lifecycle';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ExpenseCategoriesService } from './categories.service';
import { defaultExpenseCategoryRows } from './expense-rules';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { IncomeService } from './income.service';
import { ReportService } from './report.service';

@Module({
  imports: [NotificationsModule, FilesModule],
  controllers: [ExpensesController],
  providers: [ExpenseCategoriesService, ExpensesService, IncomeService, ReportService],
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
