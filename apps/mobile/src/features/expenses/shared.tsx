import type { ExpenseCategory, ExpenseStatus, ExpenseSummary } from '@movo/contracts';
import { Row, Text } from '@movo/design-system';
import { memo } from 'react';
import { View } from 'react-native';
import { i18n } from '../../core/i18n';
import { useNav } from '../../core/navigation/types';
import { CATEGORY_ICON } from '../../core/ui/category-icon';
import { StatusPill, type StatusTones } from '../../core/ui/StatusPill';
import { day } from '../../core/util/date';
import { money } from '../../core/util/money';

const TONE: StatusTones<ExpenseStatus> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

/** Seeded categories show in the member's language; committee-made ones as typed. */
export function expenseCategoryLabel(c: Pick<ExpenseCategory, 'key' | 'name'>): string {
  if (!c.key) return c.name;
  return i18n.t(`expenses:category.${c.key}` as 'expenses:category.other', {
    defaultValue: c.name,
  });
}

export function ExpenseStatusPill({ status }: { status: ExpenseStatus }) {
  return <StatusPill value={status} tones={TONE} labels="expenses:status" />;
}

export const ExpenseRow = memo(function ExpenseRow({ expense }: { expense: ExpenseSummary }) {
  const nav = useNav();
  return (
    <Row
      icon={CATEGORY_ICON[expense.category.icon]}
      title={expense.description || expenseCategoryLabel(expense.category)}
      subtitle={`${day(expense.incurredOn, 'short')} · ${expense.payeeName}`}
      trailing={
        <View className="items-end gap-1">
          <Text variant="bodyMedium" className="font-semibold">
            {money(expense.amountPaise)}
          </Text>
          {expense.status !== 'APPROVED' ? <ExpenseStatusPill status={expense.status} /> : null}
        </View>
      }
      onPress={() => nav.navigate('ExpenseDetail', { expenseId: expense.id })}
    />
  );
});
