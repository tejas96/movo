import { Button, Input, Screen, Text, TitleBar, useToast } from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useSessionStore } from '../../core/auth/session.store';
import { useNav } from '../../core/navigation/types';
import { useUpdateProfile } from './api';

export function EditProfileScreen() {
  const { t } = useTranslation(['me', 'common', 'auth', 'home']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const user = useSessionStore((s) => s.user);
  const update = useUpdateProfile();
  const [name, setName] = useState(user?.displayName ?? '');

  const save = async () => {
    if (name.trim().length < 2) return;
    try {
      await update.mutateAsync({ displayName: name.trim() });
      toast.show(t('common:actions.done'));
      nav.goBack();
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen>
      <TitleBar title={t('me:profile')} onBack={() => nav.goBack()} />
      <View className="mt-6 gap-3">
        <Input label={t('auth:fullName')} value={name} onChangeText={setName} />
        <Input
          label={t('me:phone')}
          value={user?.phone ?? ''}
          placeholder={t('me:notSet')}
          editable={false}
        />
        <Input
          label={t('me:email')}
          value={user?.email ?? ''}
          placeholder={t('me:notSet')}
          editable={false}
        />
        <Text variant="micro" tone="secondary" className="font-normal">
          {t('home:attention.PROFILE_INCOMPLETE.sub')}
        </Text>
        <Button
          label={t('common:actions.save')}
          onPress={() => void save()}
          loading={update.isPending}
        />
      </View>
    </Screen>
  );
}
