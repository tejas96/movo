import { LOCALES, type Locale } from '@movo/contracts';
import { Card, Icon, Row, Screen, TitleBar } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSessionStore } from '../../core/auth/session.store';
import { currentLocale, setAppLocale } from '../../core/i18n';
import { useNav } from '../../core/navigation/types';
import { useUpdateProfile } from './api';

export function LanguageScreen() {
  const { t } = useTranslation('common');
  const nav = useNav();
  const update = useUpdateProfile();
  const status = useSessionStore((s) => s.status);
  const active = currentLocale();

  const pick = async (locale: Locale) => {
    await setAppLocale(locale);
    if (status === 'signedIn') update.mutate({ locale });
    nav.goBack();
  };

  return (
    <Screen>
      <TitleBar title={t('language.label')} onBack={() => nav.goBack()} />
      <Card tight className="mt-6 gap-2">
        {LOCALES.map((l) => (
          <Row
            key={l}
            title={t(`language.${l}`)}
            trailing={
              l === active ? (
                <Icon name="check" variant="bold" size={22} />
              ) : (
                <View className="w-[22px]" />
              )
            }
            onPress={() => void pick(l)}
          />
        ))}
      </Card>
    </Screen>
  );
}
