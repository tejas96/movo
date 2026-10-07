import { authContract } from '@movo/contracts';
import { Button, Input, useToast } from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { api } from '../../core/api/client';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { AuthShell } from './AuthShell';

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
    <AuthShell
      title={t('auth:forgotTitle')}
      subtitle={t('auth:forgotBody')}
      onBack={() => nav.goBack()}
    >
      <View className="gap-3">
        <Input
          icon="mail"
          placeholder={t('auth:identifier')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="send"
          value={identifier}
          onChangeText={setIdentifier}
          onSubmitEditing={() => void send()}
        />
        <Button label={t('auth:sendLink')} onPress={() => void send()} loading={busy} />
        <Button
          label={t('auth:haveCode')}
          variant="gray"
          onPress={() => nav.navigate('ResetPassword', { identifier })}
        />
      </View>
    </AuthShell>
  );
}
