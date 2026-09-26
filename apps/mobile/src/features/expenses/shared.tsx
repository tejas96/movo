import type { ExpenseCategory, ExpenseStatus, ExpenseSummary } from '@movo/contracts';
import { Row, StatusPill, type StatusTone, Text } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { i18n } from '../../core/i18n';
import { useNav } from '../../core/navigation/types';
import { day, money } from '../../core/util/money';
import { CATEGORY_ICON } from '../services/shared';

const TONE: Record<ExpenseStatus, StatusTone> = {
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
  const { t } = useTranslation('expenses');
  return <StatusPill label={t(`status.${status}`)} tone={TONE[status]} />;
}

export function ExpenseRow({ expense }: { expense: ExpenseSummary }) {
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
}
