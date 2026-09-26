import { EmptyState, IconSquare, Screen, Segmented, TitleBar } from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function MoneyScreen() {
  const { t } = useTranslation('money');
  const [tab, setTab] = useState<'mine' | 'society'>('mine');
  return (
    <Screen tabBar>
      <TitleBar
        large
        title={t('title')}
        trailing={<IconSquare icon="receipt" variant="linear" />}
      />
      <Segmented
        className="mt-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'mine', label: t('myDues') },
          { value: 'society', label: t('society') },
        ]}
      />
      <EmptyState icon="wallet" title={t('noDues')} body={t('noDuesBody')} className="mt-16" />
    </Screen>
  );
}
