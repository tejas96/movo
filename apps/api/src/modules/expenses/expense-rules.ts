import {
  DEFAULT_EXPENSE_CATEGORIES,
  type ExpenseCategory,
  parseModuleSettings,
  VendorCategoryIconSchema,
} from '@movo/contracts';
import { ApiException } from '../../common/errors/api.exception';
import { can, type TenantContext } from '../../common/tenant/tenant.types';
import { todayIn } from '../../common/util/dates';
import type { ExpenseCategory as CategoryRow } from '../../generated/prisma/client';

/** Rules shared by categories, expenses, income and the FY report. */

/** Rows for a new society. */
export function defaultExpenseCategoryRows(societyId: string) {
  return DEFAULT_EXPENSE_CATEGORIES.map((c, i) => ({
    societyId,
    key: c.key,
    name: c.name,
    icon: c.icon,
    sortOrder: i,
  }));
}

/** Anyone who handles society money sees every expense, whatever the member setting says. */
export function isFinanceRole(ctx: TenantContext): boolean {
  return (
    can(ctx, 'finance.reports.view') || can(ctx, 'expense.create') || can(ctx, 'expense.approve')
  );
}

export function expensesSettings(ctx: TenantContext) {
  return parseModuleSettings('expenses', ctx.moduleSettings.expenses);
}

/** Money that went out or came in cannot be dated in the future. */
export function checkNotFuture(ctx: TenantContext, date: string) {
  if (date > todayIn(ctx.society.timezone))
    throw ApiException.validation([
      { path: ['date'], message: 'Cannot be in the future', in: 'body' },
    ]);
}

export function toCategory(c: CategoryRow): ExpenseCategory {
  const icon = VendorCategoryIconSchema.safeParse(c.icon);
  return {
    id: c.id,
    key: c.key,
    name: c.name,
    icon: icon.success ? icon.data : 'box',
    sortOrder: c.sortOrder,
  };
}
