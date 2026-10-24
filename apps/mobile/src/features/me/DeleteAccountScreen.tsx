import { Button, Card, PasswordInput, Screen, Text, TitleBar } from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { signOutLocally } from '../../core/api/client';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { useNav } from '../../core/navigation/types';
import { useDeleteAccount } from './api';

export function DeleteAccountScreen() {
  const { t } = useTranslation(['me', 'common']);
  const nav = useNav();
  const withErrorToast = useMutationToast();
  const del = useDeleteAccount();
  const [password, setPassword] = useState('');

  const confirm = async () => {
    await withErrorToast(async () => {
      await del.mutateAsync(password);
      await signOutLocally();
    });
  };

  return (
    <Screen>
      <TitleBar title={t('me:deleteAccount')} onBack={() => nav.goBack()} />
      <Card className="mt-5 gap-4">
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
      </Card>
    </Screen>
  );
}
