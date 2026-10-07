import { Avatar, Button, Input, Screen, Text, TitleBar, useToast } from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { photoUri } from '../../core/api/client';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useSessionStore } from '../../core/auth/session.store';
import { useNav } from '../../core/navigation/types';
import { type PhotoSource, usePickOne } from '../../core/photos/pick';
import { SinglePhotoField } from '../../core/photos/SinglePhotoField';
import { useRemoveAvatar, useSetAvatar, useUpdateProfile } from './api';

export function EditProfileScreen() {
  const { t } = useTranslation(['me', 'common', 'auth', 'home']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const user = useSessionStore((s) => s.user);
  const update = useUpdateProfile();
  const [name, setName] = useState(user?.displayName ?? '');
  const pickOne = usePickOne();
  const setAvatar = useSetAvatar();
  const removeAvatar = useRemoveAvatar();

  const changePhoto = async (source: PhotoSource) => {
    const asset = await pickOne(source, 512);
    if (!asset?.uri) return;
    try {
      await setAvatar.mutateAsync({ uri: asset.uri, fileName: asset.fileName, type: asset.type });
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  const clearPhoto = async () => {
    try {
      await removeAvatar.mutateAsync();
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

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
        <SinglePhotoField
          title={t('me:photo')}
          help={t('me:photoHelp')}
          hasPhoto={Boolean(user?.avatarUrl)}
          busy={setAvatar.isPending || removeAvatar.isPending}
          preview={
            <Avatar name={user?.displayName ?? '?'} uri={photoUri(user?.avatarUrl)} size={64} />
          }
          onPick={(source) => void changePhoto(source)}
          onRemove={() => void clearPhoto()}
        />
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
