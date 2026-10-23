import type { ModuleKey } from '@movo/contracts';
import {
  ArtCard,
  type ArtName,
  Avatar,
  Building,
  Glass,
  Icon,
  type IconMotion,
  type IconName,
  IconSquare,
  MovingIcon,
  Press,
  Rise,
  Row,
  Screen,
  SectionLabel,
  Text,
  TitleBar,
  theme,
} from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';
import { photoUri } from '../../core/api/client';
import { useMembers } from '../../core/members/api';
import { useNav } from '../../core/navigation/types';
import { useSocietyProfile } from '../../core/society/api';
import { formatFlat, useCanManageSociety, useTenant } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';

type HubKey = ModuleKey | 'manage';
/** Each module gets its own moving colour art and a small moving icon, as on the Home tiles. */
type ModuleTile = {
  key: HubKey;
  icon: IconName;
  motion: IconMotion;
  art: ArtName;
  labelKey: string;
};

const ORDER: ModuleTile[] = [
  { key: 'notices', icon: 'notices', motion: 'wiggle', art: 'rose', labelKey: 'notices' },
  { key: 'meetings', icon: 'meetings', motion: 'bob', art: 'meeting', labelKey: 'meetings' },
  { key: 'events', icon: 'events', motion: 'flick', art: 'flame', labelKey: 'events' },
  { key: 'directory', icon: 'directory', motion: 'bob', art: 'sand', labelKey: 'directory' },
  { key: 'vendors', icon: 'services', motion: 'wobble', art: 'meadow', labelKey: 'vendors' },
  { key: 'parking', icon: 'parking', motion: 'drive', art: 'dusk', labelKey: 'parking' },
  { key: 'tasks', icon: 'tasks', motion: 'bob', art: 'tileSage', labelKey: 'tasks' },
  {
    key: 'responsibilities',
    icon: 'duties',
    motion: 'bob',
    art: 'tileBlue',
    labelKey: 'responsibilities',
  },
  { key: 'rewards', icon: 'rewards', motion: 'wobble', art: 'sunset', labelKey: 'rewards' },
  { key: 'expenses', icon: 'receipt', motion: 'bob', art: 'tileFlame', labelKey: 'expenses' },
  { key: 'emergency', icon: 'emergency', motion: 'wiggle', art: 'tilePink', labelKey: 'emergency' },
];

const COMMITTEE_ROLES = new Set(['admin', 'committee', 'treasurer']);

export function SocietyHubScreen() {
  const { t } = useTranslation(['society', 'common']);
  const nav = useNav();
  const tenant = useTenant();
  const profile = useSocietyProfile(tenant.society.id);
  const canManage = useCanManageSociety();
  const members = useMembers(tenant.society.id, '');
  const enabled = new Set(tenant.modules.filter((m) => m.enabled).map((m) => m.key));
  const tiles: ModuleTile[] = [
    ...ORDER.filter((m) => enabled.has(m.key as ModuleKey)),
    ...(canManage
      ? [
          {
            key: 'manage',
            icon: 'settings',
            motion: 'wobble',
            art: 'tileBlue',
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

  const rows: ModuleTile[][] = [];
  for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
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
          <ArtCard art="home" height={210} contentStyle={styles.hero}>
            <View style={styles.heroArt} pointerEvents="none">
              <Building width={128} />
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

        <SectionLabel className="px-1 pt-1 pb-0">{t('society:explore')}</SectionLabel>
        <View style={styles.grid}>
          {rows.map((row, r) => (
            <Rise key={row.map((x) => x.key).join('-')} delay={100 + r * 50}>
              <View style={styles.row}>
                {row.map((tile) => {
                  const label = t(`society:modules.${tile.labelKey}` as 'society:modules.notices');
                  return (
                    <ArtCard
                      key={tile.key}
                      art={tile.art}
                      height={128}
                      radius={30}
                      onPress={() => open(tile)}
                      accessibilityLabel={label}
                      style={styles.flex}
                      contentStyle={styles.tile}
                    >
                      <View style={styles.tileIcon} pointerEvents="none">
                        <MovingIcon name={tile.icon} motion={tile.motion} />
                      </View>
                      <Text variant="h3" numberOfLines={2} style={styles.tileTitle}>
                        {label}
                      </Text>
                    </ArtCard>
                  );
                })}
                {row.length < 2 ? <View style={styles.flex} /> : null}
              </View>
            </Rise>
          ))}
        </View>

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

const styles = StyleSheet.create({
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
  grid: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  tile: { padding: 14, justifyContent: 'space-between' },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitle: { fontSize: 17, lineHeight: 23 },
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
