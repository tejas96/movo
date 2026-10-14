import type { FeatureHome } from '../home/types';

export const servicesHome: FeatureHome = {
  attention: {
    VENDOR_SUGGESTIONS: {
      row: (item, { t, nav }) => ({
        icon: 'services',
        title: t('home:attention.VENDOR_SUGGESTIONS.title', { count: item.count }),
        subtitle: t('home:attention.VENDOR_SUGGESTIONS.sub'),
        onPress: () =>
          nav.navigate('VendorList', {
            status: 'SUGGESTED',
            title: t('services:status.SUGGESTED'),
          }),
      }),
    },
  },
  quick: [
    {
      key: 'services',
      icon: 'services',
      label: (t) => t('home:quick.services'),
      visible: (q) => q.moduleOn('vendors'),
      go: (nav) => nav.navigate('Services'),
    },
  ],
};
