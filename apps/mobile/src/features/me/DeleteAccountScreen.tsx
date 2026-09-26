import { Button, PasswordInput, Screen, Text, TitleBar, useToast } from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { signOutLocally } from '../../core/api/client';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useDeleteAccount } from './api';

export function DeleteAccountScreen() {
  const { t } = useTranslation(['me', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const del = useDeleteAccount();
  const [password, setPassword] = useState('');

  const confirm = async () => {
    try {
      await del.mutateAsync(password);
      await signOutLocally();
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen>
      <TitleBar title={t('me:deleteAccount')} onBack={() => nav.goBack()} />
      <View className="mt-6 gap-4">
        <Text variant="h2">{t('me:deleteTitle')}</Text>
        <Text variant="body" tone="secondary">
          {t('me:deleteBody')}
        </Text>
        <PasswordInput label={t('me:deleteConfirm')} value={password} onChangeText={setPassword} />
        <Button
          label={t('me:deleteAccount')}
          variant="danger"
          onPress={() => void confirm()}
          disabled={password.length < 8}
          loading={del.isPending}
        />
        <Button label={t('common:actions.cancel')} variant="ghost" onPress={() => nav.goBack()} />
      </View>
    </Screen>
  );
}
