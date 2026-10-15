import type { FeatureHome } from '../../core/home/types';

export const meHome: FeatureHome = {
  attention: {
    PROFILE_INCOMPLETE: {
      id: (item) => item.missing.join(','),
      row: (_item, { t, nav }) => ({
        icon: 'mail',
        title: t('home:attention.PROFILE_INCOMPLETE.title'),
        subtitle: t('home:attention.PROFILE_INCOMPLETE.sub'),
        onPress: () => nav.navigate('EditProfile'),
      }),
    },
  },
};
