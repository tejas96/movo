import { Avatar, Card, Row, Screen, Text, TitleBar } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { signOut } from '../../core/auth/auth';
import { useSessionStore } from '../../core/auth/session.store';
import { APP_VERSION } from '../../core/env';
import { currentLocale } from '../../core/i18n';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useCan, useTenant } from '../../core/tenant/hooks';

export function MeScreen() {
  const { t } = useTranslation(['me', 'common', 'auth']);
  const nav = useNav();
  const user = useSessionStore((s) => s.user);
  const tenant = useTenant();
  const canManageMembers = useCan('member.manage');
  const canManageSettings = useCan('society.settings.manage');
  const canManage = canManageMembers || canManageSettings;

  const confirmSignOut = () =>
    Alert.alert(t('me:signOutConfirm'), undefined, [
      { text: t('common:actions.cancel'), style: 'cancel' },
      { text: t('common:actions.signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <Screen tabBar>
      <TitleBar large title={t('me:title')} />
      <Card className="mt-5 flex-row items-center gap-4">
        <Avatar name={user?.displayName ?? '?'} uri={user?.avatarUrl} size={64} />
        <View className="flex-1 min-w-0">
          <Text variant="title" numberOfLines={1}>
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
      </Card>

      <Card tight className="mt-4 gap-2">
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
        <Row icon="eye" title={t('me:privacy')} onPress={() => nav.navigate('Privacy')} />
        <Row
          icon="key"
          title={t('auth:changePassword')}
          onPress={() => nav.navigate('ChangePassword')}
        />
        {canManage ? (
          <Row
            icon="settings"
            title={t('me:manageSociety')}
            onPress={() => nav.navigate('Manage')}
          />
        ) : null}
      </Card>

      <Card tight className="mt-4 gap-2">
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
        <Row icon="logout" title={t('common:actions.signOut')} onPress={confirmSignOut} />
        <Row
          icon="trash"
          title={t('me:deleteAccount')}
          onPress={() => nav.navigate('DeleteAccount')}
        />
      </Card>
    </Screen>
  );
}
