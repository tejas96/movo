import { photos, StatusPill } from '@movo/design-system';
import { day } from '../../core/util/money';
import type { FeatureHome } from '../home/types';

export const dutiesHome: FeatureHome = {
  attention: {
    MY_DUTY: {
      id: (item) => item.assignmentId,
      row: (item, { t, nav }) => ({
        icon: 'duties',
        title: t('home:attention.MY_DUTY.title', { title: item.title }),
        subtitle: t('home:attention.MY_DUTY.sub', { date: day(item.periodEnd, 'short') }),
        trailing: item.canConfirm ? (
          <StatusPill label={t('home:attention.MY_DUTY.markDone')} tone="ink" />
        ) : undefined,
        onPress: () => nav.navigate('DutyDetail', { dutyId: item.dutyId }),
      }),
      hero: {
        priority: 2,
        card: (item, { t, nav }) => ({
          photo: photos.duties,
          label: t('home:hero.duty.label'),
          value: item.title,
          caption: t('home:attention.MY_DUTY.sub', { date: day(item.periodEnd, 'short') }),
          cta: {
            label: item.canConfirm ? t('home:attention.MY_DUTY.markDone') : t('home:hero.duty.cta'),
            go: () => nav.navigate('DutyDetail', { dutyId: item.dutyId }),
          },
        }),
      },
    },
  },
};
