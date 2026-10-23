import {
  DotTexture,
  Glass,
  Icon,
  type IconName,
  initialsOf,
  Orb,
  Press,
  Ripple,
  Rise,
  Screen,
  SectionLabel,
  Strong,
  Text,
  Toggle,
  theme,
} from '@movo/design-system';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Linking, Text as RNText, StyleSheet, View } from 'react-native';
import { photoUri } from '../../core/api/client';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { signOut } from '../../core/auth/auth';
import { useSessionStore } from '../../core/auth/session.store';
import { APP_VERSION, PRIVACY_POLICY_URL } from '../../core/env';
import { useHomeSummary } from '../../core/home/api';
import { currentLocale } from '../../core/i18n';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useCanManageSociety, useTenant } from '../../core/tenant/hooks';
import { useMyPrivacy, useUpdatePrivacy } from './api';

const AVATAR = 92;

export function MeScreen() {
  const { t } = useTranslation(['me', 'common', 'auth', 'rewards']);
  const nav = useNav();
  const user = useSessionStore((s) => s.user);
  const tenant = useTenant();
  const canManage = useCanManageSociety();
  const contribution = useHomeSummary(tenant.society.id).data?.contribution ?? null;
  const privacy = useMyPrivacy(tenant.society.id).data;
  const updatePrivacy = useUpdatePrivacy(tenant.society.id);
  const withErrorToast = useMutationToast();

  const name = user?.displayName ?? '';
  const firstName = name.split(' ')[0] ?? name;
  const flat = tenant.flats[0];
  const facts = [
    flat ? formatFlat(flat) : null,
    flat ? t(`common:relation.${flat.relation}`) : null,
    tenant.society.name,
  ].filter((x): x is string => Boolean(x));
  const avatarUri = photoUri(user?.avatarUrl);

  const confirmSignOut = () =>
    Alert.alert(t('me:signOutConfirm'), undefined, [
      { text: t('common:actions.cancel'), style: 'cancel' },
      { text: t('common:actions.signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <Screen tabBar>
      <View style={styles.page}>
        {/* Profile card: dots, the glowing avatar, "Hello Name", flat | relation | society. */}
        <Rise>
          <Glass radius={32} style={styles.profile}>
            <DotTexture center={{ x: 0.5, y: 0.3 }} reach={0.7} />
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.photo} accessibilityLabel={name} />
            ) : (
              <View style={styles.avatar}>
                {/* Mockup: one coral ring that grows to 1.7x and fades every 3.2 s. */}
                <Ripple size={AVATAR} color="#F0735A" from={0.3} to={1.7} period={3200} />
                <Orb size={AVATAR}>
                  <Text style={styles.initials}>{initialsOf(name || '?')}</Text>
                </Orb>
              </View>
            )}
            <Text variant="greet" style={styles.hello} numberOfLines={1}>
              {t('me:glow.hello')} <Strong>{firstName}</Strong>
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1} className="text-center">
              {facts.map((f, i) => (
                <RNText key={f}>
                  {i > 0 ? <RNText style={styles.bar}>{'  |  '}</RNText> : null}
                  {f}
                </RNText>
              ))}
            </Text>
            <Press
              accessibilityRole="button"
              onPress={() => nav.navigate('EditProfile')}
              scaleTo={0.97}
              style={styles.edit}
            >
              <Icon name="edit" size={15} color={theme.color.accent.fg} />
              <Text variant="bodyMedium">{t('me:glow.edit')}</Text>
            </Press>
          </Glass>
        </Rise>

        {/* Small stats, only when rewards are on and there is something to count. */}
        {contribution ? (
          <Rise delay={80}>
            <View style={styles.stats}>
              <Stat value={contribution.points} label={t('me:glow.points')} />
              <Stat value={contribution.openTasks} label={t('me:glow.tasks')} />
              <Stat value={tenant.flats.length} label={t('me:glow.flats')} />
            </View>
          </Rise>
        ) : null}

        <Rise delay={140}>
          <Glass radius={30} style={styles.list}>
            <SectionLabel>{t('me:glow.general')}</SectionLabel>
            <Item
              icon="home"
              label={t('me:societiesAndFlats')}
              onPress={() => nav.navigate('SocietySwitcher')}
            />
            <Item
              icon="bell"
              label={t('me:glow.notifications')}
              onPress={() => nav.navigate('Notifications')}
            />
            <Item
              icon="language"
              label={t('common:language.label')}
              value={t(`common:language.${currentLocale()}`)}
              onPress={() => nav.navigate('Language')}
            />
            <Item
              icon="lock"
              label={t('auth:changePassword')}
              onPress={() => nav.navigate('ChangePassword')}
            />
            {privacy?.phoneOptInAllowed ? (
              <View style={styles.item}>
                <Icon name="call" size={21} color={theme.color.icon.primary} />
                <Text variant="body" numberOfLines={1} style={styles.itemLabel}>
                  {t('me:privacyShowPhone')}
                </Text>
                <Toggle
                  value={privacy.showPhone}
                  disabled={updatePrivacy.isPending}
                  accessibilityLabel={t('me:privacyShowPhone')}
                  onValueChange={(v) =>
                    void withErrorToast(async () => {
                      await updatePrivacy.mutateAsync({ showPhone: v });
                    })
                  }
                />
              </View>
            ) : null}
            <Item icon="eye" label={t('me:privacy')} onPress={() => nav.navigate('Privacy')} />
            <Item
              icon="shield"
              label={t('me:privacyPolicy')}
              onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
            />
            {canManage ? (
              <Item
                icon="settings"
                label={t('me:manageSociety')}
                onPress={() => nav.navigate('Manage')}
              />
            ) : null}
          </Glass>
        </Rise>

        <Rise delay={200}>
          <Glass radius={30} style={styles.list}>
            <SectionLabel>{t('me:glow.others')}</SectionLabel>
            {contribution ? (
              <Item
                icon="star"
                label={t('rewards:title')}
                onPress={() => nav.navigate('Rewards')}
              />
            ) : null}
            <Item
              icon="help"
              label={t('me:help')}
              onPress={() =>
                nav.navigate('ComingSoon', { moduleKey: 'emergency', title: t('me:help') })
              }
            />
            <Item
              icon="trash"
              label={t('me:deleteAccount')}
              onPress={() => nav.navigate('DeleteAccount')}
            />
            <Item
              icon="logout"
              label={t('common:actions.signOut')}
              danger
              onPress={confirmSignOut}
            />
          </Glass>
        </Rise>

        <Text variant="label" tone="secondary" className="text-center">
          {`MOVO · ${t('me:version', { version: APP_VERSION })}`}
        </Text>
      </View>
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <Glass radius={24} style={styles.stat}>
      <Text style={styles.statValue}>{String(value)}</Text>
      <Text variant="label" tone="secondary" numberOfLines={1}>
        {label}
      </Text>
    </Glass>
  );
}

/** A plain list line: line icon, label, an optional value on the right. */
function Item({
  icon,
  label,
  value,
  danger,
  onPress,
}: {
  icon: IconName;
  label: string;
  value?: string;
  danger?: boolean;
  onPress: () => void;
}): ReactNode {
  return (
    <Press accessibilityRole="button" onPress={onPress} className="active:opacity-pressed">
      <View style={styles.item}>
        <Icon
          name={icon}
          size={21}
          color={danger ? theme.color.status.danger.fg : theme.color.icon.primary}
        />
        <Text
          variant="body"
          numberOfLines={1}
          style={[styles.itemLabel, danger ? { color: theme.color.status.danger.fg } : null]}
        >
          {label}
        </Text>
        {value ? (
          <Text variant="caption" tone="secondary">
            {value}
          </Text>
        ) : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  page: { gap: 14 },
  profile: {
    overflow: 'hidden',
    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
    gap: 12,
  },
  avatar: { width: AVATAR, height: AVATAR },
  photo: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  initials: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 28,
    lineHeight: 36,
  },
  hello: { fontSize: 24, lineHeight: 32, letterSpacing: -0.3 },
  edit: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0 4px 12px rgba(70,40,70,0.06)',
  },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 14 },
  statValue: { fontFamily: 'Poppins', fontWeight: '500', fontSize: 22, lineHeight: 30 },
  list: { padding: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    minHeight: 54,
    borderRadius: 20,
  },
  itemLabel: { flex: 1 },
  bar: { color: 'rgba(106,105,112,0.4)' },
});
