import { photos, StatusPill } from '@movo/design-system';
import type { FeatureHome } from '../../core/home/types';
import { formatFlat } from '../../core/tenant/hooks';
import { day } from '../../core/util/date';
import { money } from '../../core/util/money';

export const moneyHome: FeatureHome = {
  attention: {
    DUES: {
      id: (item) => item.flat.id,
      row: (item, { t, nav }) => ({
        icon: 'wallet',
        title: t(item.overdue ? 'home:attention.DUES.titleOverdue' : 'home:attention.DUES.title', {
          amount: money(item.amountPaise),
          flat: formatFlat(item.flat),
        }),
        subtitle: t('home:attention.DUES.sub', { date: day(item.dueDate, 'short') }),
        trailing: item.overdue ? (
          <StatusPill label={t('money:status.OVERDUE')} tone="danger" />
        ) : undefined,
        onPress: () => nav.navigate('Tabs', { screen: 'Money' }),
      }),
      hero: {
        priority: 1,
        card: (item, { t, nav }) => {
          const daysLeft = Math.ceil((Date.parse(item.dueDate) - Date.now()) / 86_400_000);
          return {
            photo: photos.money,
            label: `${t('home:hero.dues.label')} · ${formatFlat(item.flat)}`,
            value: money(item.amountPaise),
            amountPaise: item.amountPaise,
            caption: item.overdue
              ? t('home:hero.dues.overdue', { date: day(item.dueDate, 'short') })
              : t('home:hero.dues.dueIn', {
                  date: day(item.dueDate, 'short'),
                  count: Math.max(0, daysLeft),
                }),
            cta: {
              label: t('home:hero.dues.cta'),
              go: () => nav.navigate('Tabs', { screen: 'Money' }),
            },
          };
        },
      },
    },
  },
  quick: [
    {
      key: 'bills',
      icon: 'receipt',
      label: (t) => t('home:glow.bills.title'),
      visible: (q) => q.moduleOn('maintenance'),
      go: (nav) => nav.navigate('Tabs', { screen: 'Money' }),
    },
  ],
};
