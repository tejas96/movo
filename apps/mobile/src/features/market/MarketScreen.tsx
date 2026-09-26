import { EmptyState, photos, Screen, TitleBar } from '@movo/design-system';
import { useTranslation } from 'react-i18next';

export function MarketScreen() {
  const { t } = useTranslation(['society', 'common']);
  return (
    <Screen tabBar>
      <TitleBar large title={t('common:tabs.market')} />
      <EmptyState
        photo={photos.empty}
        icon="market"
        title={t('society:comingSoon')}
        body={t('society:comingSoonBody', { module: t('common:tabs.market') })}
        className="mt-16"
      />
    </Screen>
  );
}
