import { Avatar, Button, Card, photos, Row, Screen, Text, TitleBar } from '@movo/design-system';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Linking, StyleSheet, View } from 'react-native';
import { photoUri } from '../../core/api/client';
import { signOut } from '../../core/auth/auth';
import { useSessionStore } from '../../core/auth/session.store';
import { APP_VERSION, PRIVACY_POLICY_URL } from '../../core/env';
import { currentLocale } from '../../core/i18n';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useCanManageSociety, useTenant } from '../../core/tenant/hooks';

export function MeScreen() {
  const { t } = useTranslation(['me', 'common', 'auth']);
  const nav = useNav();
  const user = useSessionStore((s) => s.user);
  const tenant = useTenant();
  const canManage = useCanManageSociety();

  const confirmSignOut = () =>
    Alert.alert(t('me:signOutConfirm'), undefined, [
      { text: t('common:actions.cancel'), style: 'cancel' },
      { text: t('common:actions.signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <Screen tabBar>
      <TitleBar large title={t('me:title')} />

      {/* Profile: the society photo as a backdrop, the avatar sitting on its lower edge. */}
      <View className="mt-5">
        <View style={styles.backdrop}>
          <Image
            source={
              tenant.society.logoUrl
                ? { uri: photoUri(tenant.society.logoUrl) ?? undefined }
                : photos.society2
            }
            resizeMode="cover"
            style={styles.photo}
          />
        </View>
        <View style={styles.avatar}>
          <Avatar
            name={user?.displayName ?? '?'}
            uri={photoUri(user?.avatarUrl)}
            size={64}
            tone="gray"
          />
        </View>
        <View style={styles.identity}>
          <Text variant="h2" numberOfLines={1}>
            {user?.displayName}
          </Text>
          <Text variant="label" tone="secondary" numberOfLines={1}>
            {user?.phone ?? user?.email ?? t('me:notSet')}
          </Text>
          <Text variant="label" tone="secondary" numberOfLines={1}>
            {[tenant.society.name, tenant.flats[0] ? formatFlat(tenant.flats[0]) : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>

      <Group title={t('me:groups.account')}>
        <Row icon="user" title={t('me:profile')} onPress={() => nav.navigate('EditProfile')} />
        <Row
          icon="building"
          title={t('me:societiesAndFlats')}
          onPress={() => nav.navigate('SocietySwitcher')}
        />
        <Row
          icon="language"
          title={t('common:language.label')}
          subtitle={t(`common:language.${currentLocale()}`)}
          onPress={() => nav.navigate('Language')}
        />
        <Row
          icon="key"
          title={t('auth:changePassword')}
          onPress={() => nav.navigate('ChangePassword')}
        />
      </Group>

      <Group title={t('me:groups.privacy')}>
        <Row icon="eye" title={t('me:privacy')} onPress={() => nav.navigate('Privacy')} />
        <Row
          icon="shield"
          title={t('me:privacyPolicy')}
          onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
        />
      </Group>

      {canManage ? (
        <Group title={t('me:groups.society')}>
          <Row
            icon="settings"
            title={t('me:manageSociety')}
            onPress={() => nav.navigate('Manage')}
          />
        </Group>
      ) : null}

      <Group title={t('me:groups.support')}>
        <Row
          icon="help"
          title={t('me:help')}
          onPress={() =>
            nav.navigate('ComingSoon', { moduleKey: 'emergency', title: t('me:help') })
          }
        />
        <Row
          icon="info"
          title={t('me:about')}
          subtitle={t('me:version', { version: APP_VERSION })}
        />
      </Group>

      <View className="mt-8 gap-2">
        <Button
          label={t('common:actions.signOut')}
          variant="gray"
          icon="logout"
          onPress={confirmSignOut}
        />
        <Button
          label={t('me:deleteAccount')}
          variant="ghost"
          onPress={() => nav.navigate('DeleteAccount')}
        />
      </View>
    </Screen>
  );
}

/** A small gray label, then the rows that belong together. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-6">
      <Text variant="label" tone="secondary" className="mb-2 ml-1">
        {title}
      </Text>
      <Card tight className="gap-2">
        {children}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { height: 132, borderRadius: 28, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  avatar: {
    marginTop: -32,
    marginLeft: 16,
    alignSelf: 'flex-start',
    padding: 3,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  identity: { marginTop: 8, paddingHorizontal: 4, gap: 1 },
});
