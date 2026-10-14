import { type ExpenseStatus, expensesContract, type RouteBody } from '@movo/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api/client';
import { useCursorList } from '../../core/api/use-cursor-list';
import { homeKeys } from '../home/keys';
import { financeKeys } from './keys';

const c = expensesContract;

export function useExpenses(
  societyId: string,
  status: ExpenseStatus | undefined,
  enabled: boolean,
) {
  return useCursorList({
    queryKey: financeKeys(societyId).list(status ?? 'all'),
    fetchPage: (cursor) =>
      api(c.list, { params: { societyId }, query: { status, cursor, limit: 20 } }),
    enabled,
  });
}

export function useExpense(societyId: string, expenseId: string) {
  return useQuery({
    queryKey: financeKeys(societyId).detail(expenseId),
    queryFn: () => api(c.get, { params: { societyId, expenseId } }),
    enabled: Boolean(expenseId),
  });
}

export function useExpenseCategories(societyId: string) {
  return useQuery({
    queryKey: financeKeys(societyId).categories,
    queryFn: () => api(c.listCategories, { params: { societyId } }),
  });
}

export function useReport(societyId: string, fy: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: financeKeys(societyId).report(fy ?? 'current'),
    queryFn: () => api(c.report, { params: { societyId }, query: { fy } }),
    enabled,
  });
}

export function useIncome(societyId: string, fy: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: financeKeys(societyId).income(fy ?? 'current'),
    queryFn: () => api(c.listIncome, { params: { societyId }, query: { fy } }),
    enabled,
  });
}

/** Expenses move the report, Home and lists, so refresh all finance data. */
function useInvalidate(societyId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: financeKeys(societyId).all });
    void qc.invalidateQueries({ queryKey: homeKeys(societyId).all });
  };
}

type ExpenseBody = RouteBody<typeof c.create>;

export function useSaveExpense(societyId: string, expenseId: string | undefined) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: (body: ExpenseBody) => {
      if (!expenseId) return api(c.create, { params: { societyId }, body });
      const { idempotencyKey: _key, ...patch } = body;
      return api(c.update, { params: { societyId, expenseId }, body: patch });
    },
    onSuccess: invalidate,
  });
}

export function useDecideExpense(societyId: string, expenseId: string) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: ({ approve, reason }: { approve: boolean; reason?: string }) =>
      approve
        ? api(c.approve, { params: { societyId, expenseId } })
        : api(c.reject, { params: { societyId, expenseId }, body: { reason: reason ?? '' } }),
    onSuccess: invalidate,
  });
}

export function useRemoveExpense(societyId: string, expenseId: string) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: () => api(c.remove, { params: { societyId, expenseId } }),
    onSuccess: invalidate,
  });
}

export function useCreateIncome(societyId: string) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: (body: RouteBody<typeof c.createIncome>) =>
      api(c.createIncome, { params: { societyId }, body }),
    onSuccess: invalidate,
  });
}

export function useDeleteIncome(societyId: string) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: (incomeId: string) => api(c.deleteIncome, { params: { societyId, incomeId } }),
    onSuccess: invalidate,
  });
}

export function useSaveCategory(societyId: string) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: ({ id, name }: { id?: string; name: string }) =>
      id
        ? api(c.updateCategory, { params: { societyId, categoryId: id }, body: { name } })
        : api(c.createCategory, { params: { societyId }, body: { name, icon: 'box' } }),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory(societyId: string) {
  const invalidate = useInvalidate(societyId);
  return useMutation({
    mutationFn: (categoryId: string) =>
      api(c.deleteCategory, { params: { societyId, categoryId } }),
    onSuccess: invalidate,
  });
}
