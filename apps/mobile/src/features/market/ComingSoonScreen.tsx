import { EmptyState, Screen, TitleBar } from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { type RootStackParamList, useNav } from '../../core/navigation/types';

export function ComingSoonScreen() {
  const { t } = useTranslation('society');
  const nav = useNav();
  const { title } = useRoute<RouteProp<RootStackParamList, 'ComingSoon'>>().params;
  return (
    <Screen>
      <TitleBar title={title} onBack={() => nav.goBack()} />
      <EmptyState
        icon="clock"
        title={t('comingSoon')}
        body={t('comingSoonBody', { module: title })}
        className="mt-16"
      />
    </Screen>
  );
}
