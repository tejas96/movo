import type { Locale } from '@movo/contracts';
import {
  BottomBar,
  Button,
  Input,
  OptionSheet,
  Screen,
  SelectField,
  Skeleton,
  Text,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { localeTag } from '../../core/util/time';
import { useSocietyProfile } from '../society/api';
import { useUpdateSociety } from './api';

const LOCALES: Locale[] = ['en', 'hi', 'mr'];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function monthName(month: number): string {
  return new Intl.DateTimeFormat(localeTag(), { month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, month - 1, 1)),
  );
}

export function SocietyProfileScreen() {
  const { t } = useTranslation(['manage', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const profile = useSocietyProfile(societyId);
  const save = useUpdateSociety(societyId);
  const p = profile.data;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [locale, setLocale] = useState<Locale>('en');
  const [fyStart, setFyStart] = useState(4);
  const [joinRequests, setJoinRequests] = useState(true);
  const [sheet, setSheet] = useState<'locale' | 'fy' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!p) return;
    setName(p.name);
    setAddress(p.addressLine ?? '');
    setCity(p.city ?? '');
    setState(p.state ?? '');
    setPincode(p.pincode ?? '');
    setLocale(p.defaultLocale);
    setFyStart(p.fyStartMonth);
    setJoinRequests(p.settings.tenancy.joinRequests === 'APPROVAL');
  }, [p]);

  const orNull = (v: string) => (v.trim() ? v.trim() : null);

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError(t('common:validation.required'));
      return;
    }
    try {
      await save.mutateAsync({
        name: name.trim(),
        addressLine: orNull(address),
        city: orNull(city),
        state: orNull(state),
        pincode: orNull(pincode),
        defaultLocale: locale,
        fyStartMonth: fyStart,
        settings: { tenancy: { joinRequests: joinRequests ? 'APPROVAL' : 'OFF' } },
      });
      toast.show(t('manage:profile.saved'));
      nav.goBack();
    } catch (e) {
      setError(toMessage(e));
    }
  };

  return (
    <>
      <Screen bottomBar>
        <TitleBar title={t('manage:profile.title')} onBack={() => nav.goBack()} />
        {!p ? (
          <Skeleton className="mt-6 h-96 rounded-xl" />
        ) : (
          <View className="mt-6 gap-3">
            <Input
              label={t('manage:profile.name')}
              value={name}
              onChangeText={setName}
              maxLength={80}
            />
            <Input
              label={t('manage:profile.address')}
              value={address}
              onChangeText={setAddress}
              maxLength={200}
              multiline
            />
            <View className="flex-row gap-3">
              <Input
                containerClassName="flex-1"
                label={t('manage:profile.city')}
                value={city}
                onChangeText={setCity}
                maxLength={60}
              />
              <Input
                containerClassName="flex-1"
                label={t('manage:profile.pincode')}
                value={pincode}
                onChangeText={setPincode}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>
            <Input
              label={t('manage:profile.state')}
              value={state}
              onChangeText={setState}
              maxLength={60}
            />
            <SelectField
              label={t('manage:profile.language')}
              value={t(`common:language.${locale}`)}
              onPress={() => setSheet('locale')}
            />
            <Text variant="caption" tone="secondary" className="-mt-1">
              {t('manage:profile.languageHelp')}
            </Text>
            <SelectField
              label={t('manage:profile.fyStart')}
              value={monthName(fyStart)}
              onPress={() => setSheet('fy')}
            />
            <View className="flex-row items-center justify-between rounded-md bg-card px-[18px] py-3">
              <View className="flex-1 pr-3">
                <Text variant="body">{t('manage:profile.joinRequests')}</Text>
                <Text variant="caption" tone="secondary">
                  {t('manage:profile.joinRequestsHelp')}
                </Text>
              </View>
              <Toggle value={joinRequests} onValueChange={setJoinRequests} />
            </View>
            {error ? (
              <Text variant="caption" tone="danger">
                {error}
              </Text>
            ) : null}
          </View>
        )}
      </Screen>
      <BottomBar
        action={
          <Button
            label={t('common:actions.save')}
            inline
            loading={save.isPending}
            disabled={!p}
            onPress={() => void submit()}
          />
        }
      />
      <OptionSheet
        visible={sheet === 'locale'}
        onClose={() => setSheet(null)}
        title={t('manage:profile.language')}
        value={locale}
        options={LOCALES.map((l) => ({ value: l, label: t(`common:language.${l}`) }))}
        onSelect={setLocale}
      />
      <OptionSheet
        visible={sheet === 'fy'}
        onClose={() => setSheet(null)}
        title={t('manage:profile.fyStart')}
        value={String(fyStart)}
        options={MONTHS.map((m) => ({ value: String(m), label: monthName(m) }))}
        onSelect={(v) => setFyStart(Number(v))}
      />
    </>
  );
}
