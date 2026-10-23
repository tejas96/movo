import type { FeatureHome } from '../../core/home/types';

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
};
