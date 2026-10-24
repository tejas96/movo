import type { FeatureHome } from '../../core/home/types';

export const manageHome: FeatureHome = {
  attention: {
    JOIN_REQUESTS_PENDING: {
      row: (item, { t, nav }) => ({
        icon: 'userAdd',
        title: t('home:attention.JOIN_REQUESTS_PENDING.title', { count: item.count }),
        subtitle: t('home:attention.JOIN_REQUESTS_PENDING.sub'),
        onPress: () => nav.navigate('JoinRequests'),
      }),
    },
    INVITATIONS_PENDING: {
      row: (item, { t, nav }) => ({
        icon: 'send',
        title: t('home:attention.INVITATIONS_PENDING.title', { count: item.count }),
        subtitle: t('home:attention.INVITATIONS_PENDING.sub'),
        onPress: () => nav.navigate('Invitations'),
      }),
    },
  },
  quick: [
    {
      key: 'manage',
      icon: 'settings',
      label: (t) => t('home:quick.manage'),
      visible: (q) => q.canManage,
      go: (nav) => nav.navigate('Manage'),
    },
  ],
};
