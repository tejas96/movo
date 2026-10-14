import { money } from '../../core/util/money';
import type { FeatureHome } from '../home/types';

export const expensesHome: FeatureHome = {
  attention: {
    EXPENSES_TO_APPROVE: {
      row: (item, { t, nav }) => ({
        icon: 'receipt',
        title: t('home:attention.EXPENSES_TO_APPROVE.title', { count: item.count }),
        subtitle: t('home:attention.EXPENSES_TO_APPROVE.sub', { amount: money(item.amountPaise) }),
        onPress: () => nav.navigate('Expenses', { status: 'PENDING' }),
      }),
    },
  },
};
