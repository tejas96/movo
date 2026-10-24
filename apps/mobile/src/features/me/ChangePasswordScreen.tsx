import {
  BottomBar,
  Button,
  Card,
  PasswordInput,
  Screen,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useChangePassword } from './api';

export function ChangePasswordScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (next.length < 8) return setError(t('common:validation.passwordMin'));
    if (next !== confirm) return setError(t('common:validation.passwordMismatch'));
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      toast.show(t('auth:passwordChanged'));
      nav.goBack();
    } catch (e) {
      setError(toMessage(e));
    }
  };

  return (
    <>
      <Screen bottomBar>
        <TitleBar title={t('auth:changePassword')} onBack={() => nav.goBack()} />
        <Card className="mt-5 gap-3.5">
          <PasswordInput
            label={t('auth:currentPassword')}
            value={current}
            onChangeText={setCurrent}
          />
          <PasswordInput label={t('auth:newPassword')} value={next} onChangeText={setNext} />
          <PasswordInput
            label={t('auth:confirmPassword')}
            value={confirm}
            onChangeText={setConfirm}
          />
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </Card>
      </Screen>
      <BottomBar
        action={
          <Button
            inline
            label={t('common:actions.save')}
            onPress={() => void save()}
            loading={change.isPending}
          />
        }
      />
    </>
  );
}
