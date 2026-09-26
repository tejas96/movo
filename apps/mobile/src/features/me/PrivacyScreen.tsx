import { Card, Screen, Text, TitleBar, Toggle, useToast } from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { useUpdatePrivacy } from './api';

export function PrivacyScreen() {
  const { t } = useTranslation('me');
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const update = useUpdatePrivacy(societyId);
  const [showPhone, setShowPhone] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const change = async (patch: { showPhone?: boolean; showEmail?: boolean }) => {
    try {
      const res = await update.mutateAsync(patch);
      setShowPhone(res.showPhone);
      setShowEmail(res.showEmail);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen>
      <TitleBar title={t('privacy')} onBack={() => nav.goBack()} />
      <Card tight className="mt-6 gap-2">
        <View className="flex-row items-center justify-between rounded-lg bg-card px-4 py-3.5">
          <Text variant="body" className="flex-1 pr-3">
            {t('privacyShowPhone')}
          </Text>
          <Toggle value={showPhone} onValueChange={(v) => void change({ showPhone: v })} />
        </View>
        <View className="flex-row items-center justify-between rounded-lg bg-card px-4 py-3.5">
          <Text variant="body" className="flex-1 pr-3">
            {t('privacyShowEmail')}
          </Text>
          <Toggle value={showEmail} onValueChange={(v) => void change({ showEmail: v })} />
        </View>
      </Card>
    </Screen>
  );
}
