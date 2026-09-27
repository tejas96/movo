import { Card, Screen, Skeleton, Text, TitleBar, Toggle, useToast } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { useMyPrivacy, useUpdatePrivacy } from './api';

export function PrivacyScreen() {
  const { t } = useTranslation('me');
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const privacy = useMyPrivacy(societyId);
  const update = useUpdatePrivacy(societyId);
  const p = privacy.data;

  const change = async (patch: { showPhone?: boolean; showEmail?: boolean }) => {
    try {
      await update.mutateAsync(patch);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen>
      <TitleBar title={t('privacy')} onBack={() => nav.goBack()} />
      {!p ? (
        <Skeleton className="mt-6 h-40 rounded-xl" />
      ) : (
        <Card tight className="mt-6 gap-2">
          <View className="flex-row items-center justify-between rounded-lg bg-card px-4 py-3.5">
            <View className="flex-1 pr-3">
              <Text variant="body">{t('privacyShowPhone')}</Text>
              {!p.phoneOptInAllowed ? (
                <Text variant="caption" tone="secondary">
                  {t('privacyPhoneOff')}
                </Text>
              ) : null}
            </View>
            <Toggle
              value={p.showPhone}
              disabled={!p.phoneOptInAllowed || update.isPending}
              onValueChange={(v) => void change({ showPhone: v })}
            />
          </View>
          <View className="flex-row items-center justify-between rounded-lg bg-card px-4 py-3.5">
            <Text variant="body" className="flex-1 pr-3">
              {t('privacyShowEmail')}
            </Text>
            <Toggle
              value={p.showEmail}
              disabled={update.isPending}
              onValueChange={(v) => void change({ showEmail: v })}
            />
          </View>
        </Card>
      )}
    </Screen>
  );
}
