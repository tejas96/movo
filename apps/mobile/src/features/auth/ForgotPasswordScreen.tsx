import { authContract } from '@movo/contracts';
import { Button, Input, Screen, Text, TitleBar, useToast } from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { api } from '../../core/api/client';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';

export function ForgotPasswordScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (identifier.trim().length < 3) return;
    setBusy(true);
    try {
      await api(authContract.forgotPassword, { body: { identifier } });
      toast.show(t('auth:linkSent'), 'info');
      nav.navigate('ResetPassword', { identifier });
    } catch (e) {
      toast.show(toMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TitleBar title={t('auth:forgotTitle')} onBack={() => nav.goBack()} />
      <Text variant="body" tone="secondary" className="mt-6">
        {t('auth:forgotBody')}
      </Text>
      <View className="mt-6 gap-3">
        <Input
          label={t('auth:identifier')}
          autoCapitalize="none"
          keyboardType="email-address"
          value={identifier}
          onChangeText={setIdentifier}
        />
        <Button label={t('auth:sendLink')} onPress={() => void send()} loading={busy} />
        <Button
          label={t('auth:haveCode')}
          variant="gray"
          onPress={() => nav.navigate('ResetPassword', { identifier })}
        />
      </View>
    </Screen>
  );
}
