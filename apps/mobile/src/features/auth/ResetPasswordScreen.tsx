import { authContract } from '@movo/contracts';
import { Button, Input, PasswordInput, Text, useToast } from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { api } from '../../core/api/client';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { AuthShell } from './AuthShell';

export function ResetPasswordScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const nav = useNav();
  const route = useRoute<RouteProp<RootStackParamList, 'ResetPassword'>>();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const [identifier, setIdentifier] = useState(route.params?.identifier ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 8) {
      setError(t('common:validation.passwordMin'));
      return;
    }
    setBusy(true);
    try {
      await api(authContract.resetPassword, {
        body: { identifier, code: code.trim(), newPassword: password },
      });
      toast.show(t('auth:resetDone'));
      nav.navigate('Login');
    } catch (e) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={t('auth:resetTitle')}
      subtitle={t('auth:resetBody')}
      onBack={() => nav.goBack()}
    >
      <View className="gap-3">
        <Input
          icon="mail"
          placeholder={t('auth:identifier')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="next"
          value={identifier}
          onChangeText={setIdentifier}
        />
        <Input
          icon="key"
          placeholder={t('auth:resetCode')}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="next"
          value={code}
          onChangeText={setCode}
        />
        <PasswordInput
          icon="lock"
          placeholder={t('auth:newPassword')}
          textContentType="newPassword"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={() => void submit()}
          returnKeyType="go"
        />
        {error ? (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        ) : null}
        <Button label={t('common:actions.continue')} onPress={() => void submit()} loading={busy} />
      </View>
    </AuthShell>
  );
}
