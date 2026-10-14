import type { ExpenseStatus } from '@movo/contracts';
import { editorOptions, type FeatureRoutes } from '../../core/navigation/routes';
import { ExpenseCategoriesScreen } from './ExpenseCategoriesScreen';
import { ExpenseDetailScreen } from './ExpenseDetailScreen';
import { ExpenseEditorScreen } from './ExpenseEditorScreen';
import { ExpensesScreen } from './ExpensesScreen';

export type ExpensesParams = {
  Expenses: { status?: ExpenseStatus } | undefined;
  ExpenseDetail: { expenseId: string };
  ExpenseEditor: { expenseId?: string } | undefined;
  ExpenseCategories: undefined;
};

export const expensesRoutes: FeatureRoutes<ExpensesParams> = {
  screens: [
    { name: 'Expenses', component: ExpensesScreen, group: 'app' },
    { name: 'ExpenseDetail', component: ExpenseDetailScreen, group: 'app' },
    { name: 'ExpenseEditor', component: ExpenseEditorScreen, group: 'app', options: editorOptions },
    { name: 'ExpenseCategories', component: ExpenseCategoriesScreen, group: 'app' },
  ],
  notifications: [{ kind: 'expense', route: 'ExpenseDetail', param: 'expenseId' }],
};
