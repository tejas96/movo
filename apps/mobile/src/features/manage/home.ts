import type { FeatureHome } from '../home/types';

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
      // The last slot: Market when it is on, otherwise Manage for people who can manage.
      visible: (q) => !q.moduleOn('marketplace') && q.canManage,
      go: (nav) => nav.navigate('Manage'),
    },
  ],
};
