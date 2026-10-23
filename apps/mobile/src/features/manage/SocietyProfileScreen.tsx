import { type Locale, type SocietyProfile, societyContract } from '@movo/contracts';
import {
  BottomBar,
  Button,
  IconSquare,
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
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';
import { photoUri, uploadFile } from '../../core/api/client';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { bodyResolver, formMessage, usePrefill } from '../../core/forms/contract-form';
import { useNav } from '../../core/navigation/types';
import { type PhotoSource, usePickOne } from '../../core/photos/pick';
import { SinglePhotoField } from '../../core/photos/SinglePhotoField';
import { useSocietyProfile } from '../../core/society/api';
import { useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { monthName } from '../../core/util/date';
import { useUpdateSociety } from './api';

const LOCALES: Locale[] = ['en', 'hi', 'mr'];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface ProfileForm {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  locale: Locale;
  fyStart: number;
  joinRequests: boolean;
}

const EMPTY: ProfileForm = {
  name: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  locale: 'en',
  fyStart: 4,
  joinRequests: true,
};

function toForm(p: SocietyProfile): ProfileForm {
  return {
    name: p.name,
    address: p.addressLine ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    pincode: p.pincode ?? '',
    locale: p.defaultLocale,
    fyStart: p.fyStartMonth,
    joinRequests: p.settings.tenancy.joinRequests === 'APPROVAL',
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

function toBody(v: ProfileForm) {
  return {
    name: v.name.trim(),
    addressLine: orNull(v.address),
    city: orNull(v.city),
    state: orNull(v.state),
    pincode: orNull(v.pincode),
    defaultLocale: v.locale,
    fyStartMonth: v.fyStart,
    settings: {
      tenancy: { joinRequests: v.joinRequests ? ('APPROVAL' as const) : ('OFF' as const) },
    },
  };
}

export function SocietyProfileScreen() {
  const { t } = useTranslation(['manage', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const profile = useSocietyProfile(societyId);
  const save = useUpdateSociety(societyId);
  // The photo saves on its own, apart from the form below.
  const saveLogo = useUpdateSociety(societyId);
  const pickOne = usePickOne();
  const [logoBusy, setLogoBusy] = useState(false);
  const p = profile.data;

  const changeLogo = async (source: PhotoSource) => {
    const asset = await pickOne(source, 1600);
    if (!asset?.uri) return;
    const { uri, fileName, type } = asset;
    setLogoBusy(true);
    await withErrorToast(async () => {
      const ref = await uploadFile(societyId, { uri, fileName, type }, 'SOCIETY_LOGO');
      await saveLogo.mutateAsync({ logoFileId: ref.id });
    });
    setLogoBusy(false);
  };

  const clearLogo = async () => {
    setLogoBusy(true);
    await withErrorToast(() => saveLogo.mutateAsync({ logoFileId: null }));
    setLogoBusy(false);
  };

  const [sheet, setSheet] = useState<'locale' | 'fy' | null>(null);
  const form = useForm<ProfileForm>({
    resolver: bodyResolver(societyContract.update.body, toBody),
    defaultValues: EMPTY,
    reValidateMode: 'onSubmit',
  });
  usePrefill(form, p, toForm);
  const error = formMessage(form, t('common:validation.required'));
  const { locale, fyStart, joinRequests } = form.watch();

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(toBody(values));
      toast.show(t('manage:profile.saved'));
      nav.goBack();
    } catch (e) {
      form.setError('root.server', { message: toMessage(e) });
    }
  });

  return (
    <>
      <Screen bottomBar>
        <TitleBar title={t('manage:profile.title')} onBack={() => nav.goBack()} />
        {loadFailed(profile) ? (
          <QueryError query={profile} className="mt-6" />
        ) : !p ? (
          <Skeleton className="mt-6 h-96 rounded-xl" />
        ) : (
          <View className="mt-6 gap-3">
            <SinglePhotoField
              title={t('manage:profile.logo')}
              help={t('manage:profile.logoHelp')}
              hasPhoto={Boolean(p.logoUrl)}
              busy={logoBusy}
              preview={
                p.logoUrl ? (
                  <Image
                    source={{ uri: photoUri(p.logoUrl) ?? undefined }}
                    resizeMode="cover"
                    style={{ width: 64, height: 64, borderRadius: 16 }}
                  />
                ) : (
                  <IconSquare icon="building" tone="white" />
                )
              }
              onPick={(source) => void changeLogo(source)}
              onRemove={() => void clearLogo()}
            />
            <Controller
              control={form.control}
              name="name"
              render={({ field }) => (
                <Input
                  label={t('manage:profile.name')}
                  value={field.value}
                  onChangeText={field.onChange}
                  maxLength={80}
                />
              )}
            />
            <Controller
              control={form.control}
              name="address"
              render={({ field }) => (
                <Input
                  label={t('manage:profile.address')}
                  value={field.value}
                  onChangeText={field.onChange}
                  maxLength={200}
                  multiline
                />
              )}
            />
            <View className="flex-row gap-3">
              <Controller
                control={form.control}
                name="city"
                render={({ field }) => (
                  <Input
                    containerClassName="flex-1"
                    label={t('manage:profile.city')}
                    value={field.value}
                    onChangeText={field.onChange}
                    maxLength={60}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="pincode"
                render={({ field }) => (
                  <Input
                    containerClassName="flex-1"
                    label={t('manage:profile.pincode')}
                    value={field.value}
                    onChangeText={field.onChange}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                )}
              />
            </View>
            <Controller
              control={form.control}
              name="state"
              render={({ field }) => (
                <Input
                  label={t('manage:profile.state')}
                  value={field.value}
                  onChangeText={field.onChange}
                  maxLength={60}
                />
              )}
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
            <View className="flex-row items-center justify-between rounded-[22px] bg-card-nested px-[18px] py-3">
              <View className="flex-1 pr-3">
                <Text variant="body">{t('manage:profile.joinRequests')}</Text>
                <Text variant="caption" tone="secondary">
                  {t('manage:profile.joinRequestsHelp')}
                </Text>
              </View>
              <Toggle
                value={joinRequests}
                onValueChange={(on) => form.setValue('joinRequests', on)}
              />
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
        onSelect={(l) => form.setValue('locale', l)}
      />
      <OptionSheet
        visible={sheet === 'fy'}
        onClose={() => setSheet(null)}
        title={t('manage:profile.fyStart')}
        value={String(fyStart)}
        options={MONTHS.map((m) => ({ value: String(m), label: monthName(m) }))}
        onSelect={(v) => form.setValue('fyStart', Number(v))}
      />
    </>
  );
}
