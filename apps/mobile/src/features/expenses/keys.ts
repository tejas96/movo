import { societyKey } from '../../core/api/query-keys';

/** Expenses, categories and the year report share the `finance` root. */
export const financeKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    all: [...root, 'finance'] as const,
    list: (filter: string) => [...root, 'finance', 'expenses', filter] as const,
    detail: (expenseId: string) => [...root, 'finance', 'expense', expenseId] as const,
    categories: [...root, 'finance', 'categories'] as const,
    report: (fy: string) => [...root, 'finance', 'report', fy] as const,
    income: (fy: string) => [...root, 'finance', 'income', fy] as const,
  };
};
