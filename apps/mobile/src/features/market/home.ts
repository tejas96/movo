import type { FeatureHome } from '../home/types';

export const marketHome: FeatureHome = {
  attention: {
    MARKET_ORDERS_WAITING: {
      row: (item, { t, nav }) => ({
        icon: 'market',
        title: t('home:attention.MARKET_ORDERS_WAITING.title', { count: item.count }),
        subtitle: t('home:attention.MARKET_ORDERS_WAITING.sub'),
        onPress: () => nav.navigate('Orders', { role: 'SELLING' }),
      }),
    },
  },
  quick: [
    {
      key: 'market',
      icon: 'market',
      label: (t) => t('home:quick.market'),
      visible: (q) => q.moduleOn('marketplace'),
      go: (nav) => nav.navigate('Tabs', { screen: 'Market' }),
    },
  ],
};
