import { authContract } from '@movo/contracts';
import { Button, Input, useToast } from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { api } from '../../core/api/client';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { useNav } from '../../core/navigation/types';
import { AuthShell } from '../../core/ui/AuthShell';

export function ForgotPasswordScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const nav = useNav();
  const toast = useToast();
  const withErrorToast = useMutationToast();
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (identifier.trim().length < 3) return;
    setBusy(true);
    await withErrorToast(async () => {
      await api(authContract.forgotPassword, { body: { identifier } });
      toast.show(t('auth:linkSent'), 'info');
      nav.navigate('ResetPassword', { identifier });
    });
    setBusy(false);
  };

  return (
    <AuthShell
      title={t('auth:glow.forgotA')}
      titleBold={t('auth:glow.forgotB')}
      subtitle={t('auth:forgotBody')}
      onBack={() => nav.goBack()}
      action={
        <>
          <Button
            size="xl"
            arrow
            label={t('auth:sendLink')}
            onPress={() => void send()}
            loading={busy}
          />
          <Button
            label={t('auth:haveCode')}
            variant="white"
            onPress={() => nav.navigate('ResetPassword', { identifier })}
          />
        </>
      }
    >
      <View className="gap-3">
        <Input
          label={t('auth:identifier')}
          placeholder={t('auth:glow.phoneHint')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="send"
          value={identifier}
          onChangeText={setIdentifier}
          onSubmitEditing={() => void send()}
        />
      </View>
    </AuthShell>
  );
}
