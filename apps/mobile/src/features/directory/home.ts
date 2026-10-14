import type { FeatureHome } from '../home/types';

export const directoryHome: FeatureHome = {
  quick: [
    {
      key: 'directory',
      icon: 'directory',
      label: (t) => t('home:quick.directory'),
      go: (nav) => nav.navigate('Directory'),
    },
  ],
};
