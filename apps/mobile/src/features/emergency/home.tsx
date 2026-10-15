import { photos, StatusPill } from '@movo/design-system';
import type { AttentionOf, FeatureHome, HomeT } from '../../core/home/types';
import { formatFlat } from '../../core/tenant/hooks';
import { relative } from '../../core/util/date';
import { ALERT_ICON } from './shared';

function alertText(item: AttentionOf<'ACTIVE_ALERT'>, t: HomeT) {
  return {
    title: t('home:attention.ACTIVE_ALERT.title', { type: t(`emergency:type.${item.alertType}`) }),
    sub: t('home:attention.ACTIVE_ALERT.sub', {
      place: item.flat ? formatFlat(item.flat) : t('emergency:societyPlace'),
      time: relative(item.createdAt),
    }),
  };
}

export const emergencyHome: FeatureHome = {
  attention: {
    ACTIVE_ALERT: {
      id: (item) => item.alertId,
      row: (item, { t, nav }) => {
        const { title, sub } = alertText(item, t);
        return {
          tone: 'danger',
          icon: ALERT_ICON[item.alertType],
          title,
          subtitle: sub,
          trailing: <StatusPill label={t('emergency:status.ACTIVE')} tone="danger" dot />,
          onPress: () => nav.navigate('AlertDetail', { alertId: item.alertId }),
        };
      },
      hero: {
        priority: 0,
        card: (item, { t, nav }) => {
          const { title, sub } = alertText(item, t);
          return {
            photo: photos.emergency,
            danger: true,
            label: t('home:hero.alert.label'),
            value: title,
            caption: sub,
            cta: {
              label: t('home:hero.alert.cta'),
              go: () => nav.navigate('AlertDetail', { alertId: item.alertId }),
            },
          };
        },
      },
    },
  },
  quick: [
    {
      key: 'emergency',
      icon: 'emergency',
      label: (t) => t('home:quick.emergency'),
      visible: (q) => q.moduleOn('emergency'),
      dot: (q) => q.attention.some((a) => a.type === 'ACTIVE_ALERT'),
      go: (nav) => nav.navigate('Emergency'),
    },
  ],
};
