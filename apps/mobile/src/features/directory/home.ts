import type { FeatureHome } from '../../core/home/types';

export const directoryHome: FeatureHome = {
  quick: [
    {
      key: 'directory',
      icon: 'directory',
      label: (t) => t('home:glow.members.title'),
      go: (nav) => nav.navigate('Directory'),
    },
  ],
};
