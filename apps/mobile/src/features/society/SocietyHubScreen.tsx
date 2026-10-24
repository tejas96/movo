import type { AttentionItem, ModuleKey } from '@movo/contracts';
import {
  ArtCard,
  Avatar,
  Building,
  Glass,
  Icon,
  IconGrid,
  type IconMotion,
  type IconName,
  IconSquare,
  Press,
  Rise,
  Row,
  Screen,
  SectionLabel,
  Text,
  TitleBar,
  theme,
  tint,
} from '@movo/design-system';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { photoUri } from '../../core/api/client';
import { useHomeSummary } from '../../core/home/api';
import { useMembers } from '../../core/members/api';
import { useNav } from '../../core/navigation/types';
import { useSocietyProfile } from '../../core/society/api';
import { formatFlat, useCanManageSociety, useTenant } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { relative, whenRange } from '../../core/util/date';

type HubKey = ModuleKey | 'manage';
/** Each module: its icon, how the icon moves, and a soft tint for the circle behind it. */
type ModuleTile = {
  key: HubKey;
  icon: IconName;
  motion: IconMotion;
  tint: string;
  labelKey: string;
};

const TINT = tint;

const ORDER: ModuleTile[] = [
  { key: 'notices', icon: 'notices', motion: 'wiggle', tint: TINT.peach, labelKey: 'notices' },
  { key: 'meetings', icon: 'meetings', motion: 'bob', tint: TINT.lavender, labelKey: 'meetings' },
  { key: 'events', icon: 'events', motion: 'flick', tint: TINT.sand, labelKey: 'events' },
  { key: 'directory', icon: 'directory', motion: 'bob', tint: TINT.peach, labelKey: 'directory' },
  { key: 'vendors', icon: 'services', motion: 'wobble', tint: TINT.sage, labelKey: 'vendors' },
  { key: 'parking', icon: 'parking', motion: 'drive', tint: TINT.blue, labelKey: 'parking' },
  { key: 'tasks', icon: 'tasks', motion: 'bob', tint: TINT.sage, labelKey: 'tasks' },
  {
    key: 'responsibilities',
    icon: 'duties',
    motion: 'bob',
    tint: TINT.blue,
    labelKey: 'responsibilities',
  },
  { key: 'rewards', icon: 'rewards', motion: 'wobble', tint: TINT.sand, labelKey: 'rewards' },
  { key: 'expenses', icon: 'receipt', motion: 'bob', tint: TINT.sand, labelKey: 'expenses' },
  { key: 'emergency', icon: 'emergency', motion: 'wiggle', tint: TINT.pink, labelKey: 'emergency' },
];

const COMMITTEE_ROLES = new Set(['admin', 'committee', 'treasurer']);

export function SocietyHubScreen() {
  const { t } = useTranslation(['society', 'common', 'emergency']);
  const nav = useNav();
  const tenant = useTenant();
  const profile = useSocietyProfile(tenant.society.id);
  const canManage = useCanManageSociety();
  const members = useMembers(tenant.society.id, '');
  const summary = useHomeSummary(tenant.society.id).data;
  const attention = summary?.attention ?? [];
  const alerts = attention.filter((a) => a.type === 'ACTIVE_ALERT');
  const unread = (summary?.notices ?? []).filter((n) => !n.readAt).length;
  const next = summary?.upcoming[0];
  const dot: Partial<Record<HubKey, string>> = {
    ...(unread > 0 ? { notices: theme.color.accent.fg } : {}),
    ...(alerts.length > 0 ? { emergency: theme.color.status.danger.fg } : {}),
    ...(attention.some((a) => a.type === 'MY_TASK') ? { tasks: theme.color.accent.fg } : {}),
    ...(attention.some((a) => a.type === 'MY_DUTY')
      ? { responsibilities: theme.color.accent.fg }
      : {}),
  };
  const enabled = new Set(tenant.modules.filter((m) => m.enabled).map((m) => m.key));
  const tiles: ModuleTile[] = [
    ...ORDER.filter((m) => enabled.has(m.key as ModuleKey)),
    ...(canManage
      ? [
          {
            key: 'manage',
            icon: 'settings',
            motion: 'wobble',
            tint: TINT.lavender,
            labelKey: 'manage',
          } as ModuleTile,
        ]
      : []),
  ];
  const committee = (members.data?.pages.flatMap((p) => p.items) ?? [])
    .filter((m) => m.roles.some((r) => COMMITTEE_ROLES.has(r.key)))
    .slice(0, 3);

  const open = (tile: ModuleTile) => {
    const title = t(`society:modules.${tile.labelKey}` as 'society:modules.notices');
    if (tile.key === 'notices') nav.navigate('Notices');
    else if (tile.key === 'meetings') nav.navigate('Meetings');
    else if (tile.key === 'events') nav.navigate('Events');
    else if (tile.key === 'expenses') nav.navigate('Expenses');
    else if (tile.key === 'tasks') nav.navigate('Tasks');
    else if (tile.key === 'responsibilities') nav.navigate('Duties');
    else if (tile.key === 'rewards') nav.navigate('Rewards');
    else if (tile.key === 'directory') nav.navigate('Directory');
    else if (tile.key === 'vendors') nav.navigate('Services');
    else if (tile.key === 'parking') nav.navigate('Parking');
    else if (tile.key === 'emergency') nav.navigate('Emergency');
    else if (tile.key === 'manage') nav.navigate('Manage');
    else nav.navigate('ComingSoon', { moduleKey: tile.key, title });
  };

  const p = profile.data;

  return (
    <Screen tabBar refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()}>
      <View style={styles.page}>
        <Rise>
          <TitleBar
            large
            title={t('common:tabs.society')}
            trailing={
              <IconSquare
                icon="search"
                variant="linear"
                diameter={46}
                onPress={() => nav.navigate('Directory')}
                accessibilityLabel={t('society:directory.search')}
              />
            }
          />
        </Rise>

        {/* The society on its art card, with the floating building. */}
        <Rise delay={60}>
          <ArtCard art="home" height={150} contentStyle={styles.hero}>
            <View style={styles.heroArt} pointerEvents="none">
              <Building width={96} />
            </View>
            {tenant.society.city ? (
              <View style={styles.cityPill}>
                <Icon name="location" size={13} color={theme.color.text.primary} />
                <Text variant="label" className="font-medium" numberOfLines={1}>
                  {tenant.society.city}
                </Text>
              </View>
            ) : null}
            <View style={styles.heroBottom}>
              <Text variant="h2" numberOfLines={2} style={styles.heroName}>
                {tenant.society.name}
              </Text>
              {p ? (
                <View style={styles.facts}>
                  <Fact label={t('society:wings', { count: p.counts.buildings })} />
                  <Fact label={t('society:flats', { count: p.counts.flats })} />
                  <Fact label={t('society:members', { count: p.counts.members })} />
                </View>
              ) : null}
            </View>
          </ArtCard>
        </Rise>
        {loadFailed(profile) ? <QueryError query={profile} /> : null}

        {alerts.length > 0 || next || unread > 0 ? (
          <Rise delay={100}>
            <Glass radius={28} style={styles.list}>
              <SectionLabel>{t('society:hub.now')}</SectionLabel>
              {alerts.length > 0 ? (
                <Row
                  tone="danger"
                  icon="emergency"
                  title={t('society:hub.alerts', { count: alerts.length })}
                  subtitle={alertLine(alerts[0], t)}
                  onPress={() => nav.navigate('Emergency')}
                />
              ) : null}
              {next ? (
                <Row
                  leading={
                    <Disc
                      icon={next.kind === 'MEETING' ? 'meetings' : 'events'}
                      tint={next.kind === 'MEETING' ? TINT.lavender : TINT.sand}
                    />
                  }
                  title={next.title}
                  subtitle={[whenRange(next.startsAt, next.endsAt), next.location]
                    .filter(Boolean)
                    .join(' · ')}
                  onPress={() =>
                    next.kind === 'MEETING'
                      ? nav.navigate('MeetingDetail', { meetingId: next.id })
                      : nav.navigate('EventDetail', { eventId: next.id })
                  }
                />
              ) : null}
              {unread > 0 ? (
                <Row
                  leading={<Disc icon="notices" tint={TINT.peach} />}
                  title={t('society:hub.newNotices', { count: unread })}
                  subtitle={summary?.notices.find((n) => !n.readAt)?.title}
                  onPress={() => nav.navigate('Notices')}
                />
              ) : null}
            </Glass>
          </Rise>
        ) : null}

        <Rise delay={140}>
          <Glass radius={28} style={styles.explore}>
            <SectionLabel>{t('society:explore')}</SectionLabel>
            <IconGrid
              items={tiles.map((tile) => ({
                key: tile.key,
                icon: tile.icon,
                motion: tile.motion,
                tint: tile.tint,
                label: t(`society:modules.${tile.labelKey}` as 'society:modules.notices'),
                dot: dot[tile.key],
                onPress: () => open(tile),
              }))}
            />
          </Glass>
        </Rise>

        {committee.length > 0 ? (
          <Glass radius={28} style={styles.list}>
            <View style={styles.listHead}>
              <SectionLabel className="flex-1">{t('society:committee')}</SectionLabel>
              <Press
                accessibilityRole="button"
                onPress={() => nav.navigate('Directory')}
                hitSlop={8}
                style={styles.seeAll}
              >
                <Text variant="label" tone="accent" className="font-medium">
                  {t('common:actions.seeAll')}
                </Text>
              </Press>
            </View>
            {committee.map((m) => (
              <Row
                key={m.membershipId}
                onGray
                leading={<Avatar name={m.displayName} uri={photoUri(m.avatarUrl)} size={44} />}
                title={m.displayName}
                subtitle={[
                  m.roles
                    .filter((r) => r.key !== 'resident')
                    .map((r) => r.name)
                    .join(', '),
                  m.flats[0] ? formatFlat(m.flats[0]) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => nav.navigate('MemberDetail', { membershipId: m.membershipId })}
                trailing={
                  m.phone ? (
                    <Press
                      accessibilityRole="button"
                      accessibilityLabel={`${t('common:actions.call')} ${m.displayName}`}
                      onPress={() => void Linking.openURL(`tel:${m.phone}`)}
                      scaleTo={0.92}
                      style={styles.call}
                    >
                      <Icon name="call" size={17} color={theme.color.accent.fg} />
                    </Press>
                  ) : undefined
                }
              />
            ))}
          </Glass>
        ) : null}
      </View>
    </Screen>
  );
}

function Fact({ label }: { label: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="label" className="font-medium" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** A small round icon on a soft tint, for the rows in Happening now. */
function Disc({ icon, tint }: { icon: IconName; tint: string }) {
  return (
    <View style={[styles.disc, { backgroundColor: tint }]}>
      <Icon name={icon} size={20} color={theme.color.icon.primary} />
    </View>
  );
}

function alertLine(
  a: AttentionItem | undefined,
  t: TFunction<['society', 'common', 'emergency']>,
): string {
  if (a?.type !== 'ACTIVE_ALERT') return '';
  return [
    t(`emergency:type.${a.alertType}`),
    a.flat ? formatFlat(a.flat) : null,
    relative(a.createdAt),
  ]
    .filter(Boolean)
    .join(' · ');
}

const styles = StyleSheet.create({
  explore: { padding: 8, paddingBottom: 14 },
  disc: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  page: { gap: 14 },
  hero: { padding: 16, justifyContent: 'space-between' },
  heroArt: { position: 'absolute', right: 10, top: 6 },
  cityPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  heroBottom: { gap: 10 },
  heroName: { maxWidth: '62%' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fact: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  flex: { flex: 1, minWidth: 0 },
  list: { padding: 8 },
  listHead: { flexDirection: 'row', alignItems: 'center' },
  seeAll: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  call: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(70,40,70,0.06)',
  },
});
