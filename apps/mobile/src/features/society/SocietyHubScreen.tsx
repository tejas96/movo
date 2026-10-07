import type { ModuleKey } from '@movo/contracts';
import {
  CircleButton,
  type IconName,
  IconSquare,
  PersonCard,
  PhotoCard,
  type PhotoName,
  PhotoTile,
  Pill,
  photos,
  Screen,
  SectionHeader,
  Text,
  TitleBar,
} from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { photoUri } from '../../core/api/client';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useCanManageSociety, useTenant } from '../../core/tenant/hooks';
import { useMembers } from '../directory/api';
import { useSocietyProfile } from './api';

type HubKey = ModuleKey | 'manage';
type ModuleTile = { key: HubKey; icon: IconName; photo: PhotoName; labelKey: string };

const ORDER: ModuleTile[] = [
  { key: 'notices', icon: 'notices', photo: 'notices', labelKey: 'notices' },
  { key: 'meetings', icon: 'meetings', photo: 'meetings', labelKey: 'meetings' },
  { key: 'events', icon: 'events', photo: 'events', labelKey: 'events' },
  { key: 'directory', icon: 'directory', photo: 'directory', labelKey: 'directory' },
  { key: 'vendors', icon: 'services', photo: 'services', labelKey: 'vendors' },
  { key: 'parking', icon: 'parking', photo: 'parking', labelKey: 'parking' },
  { key: 'tasks', icon: 'tasks', photo: 'tasks', labelKey: 'tasks' },
  { key: 'responsibilities', icon: 'duties', photo: 'duties', labelKey: 'responsibilities' },
  { key: 'rewards', icon: 'rewards', photo: 'rewards', labelKey: 'rewards' },
  { key: 'expenses', icon: 'receipt', photo: 'expenses', labelKey: 'expenses' },
  { key: 'emergency', icon: 'emergency', photo: 'emergency', labelKey: 'emergency' },
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
      ? [{ key: 'manage', icon: 'settings', photo: 'manage', labelKey: 'manage' } as ModuleTile]
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
      <TitleBar
        large
        title={t('common:tabs.society')}
        trailing={
          <IconSquare icon="search" variant="linear" onPress={() => nav.navigate('Directory')} />
        }
      />
      <PhotoCard
        className="mt-5"
        source={
          tenant.society.logoUrl
            ? { uri: photoUri(tenant.society.logoUrl) ?? undefined }
            : photos.society
        }
        photoHeight={190}
        badge={tenant.society.city ? { icon: 'location', label: tenant.society.city } : undefined}
      >
        <Text variant="h2" numberOfLines={2}>
          {tenant.society.name}
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {p ? (
            <>
              <Pill
                icon="building"
                size="sm"
                label={t('society:wings', { count: p.counts.buildings })}
              />
              <Pill icon="flat" size="sm" label={t('society:flats', { count: p.counts.flats })} />
              <Pill
                icon="people"
                size="sm"
                label={t('society:members', { count: p.counts.members })}
              />
            </>
          ) : null}
        </View>
      </PhotoCard>

      <SectionHeader title={t('society:explore')} />
      <View className="gap-3">
        {rows.map((row) => (
          <View key={row.map((r) => r.key).join('-')} className="flex-row gap-3">
            {row.map((tile) => (
              <PhotoTile
                key={tile.key}
                source={photos[tile.photo]}
                icon={tile.icon}
                label={t(`society:modules.${tile.labelKey}` as 'society:modules.notices')}
                onPress={() => open(tile)}
              />
            ))}
            {row.length < 2 ? <View className="flex-1" /> : null}
          </View>
        ))}
      </View>

      {committee.length > 0 ? (
        <>
          <SectionHeader
            title={t('society:committee')}
            actionLabel={t('common:actions.seeAll')}
            onAction={() => nav.navigate('Directory')}
          />
          <View className="gap-3">
            {committee.map((m) => (
              <PersonCard
                key={m.membershipId}
                name={m.displayName}
                avatarUri={photoUri(m.avatarUrl)}
                verified={m.roles.some((r) => r.key === 'admin')}
                role={[
                  m.roles.map((r) => r.name).join(', '),
                  m.flats[0] ? formatFlat(m.flats[0]) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => nav.navigate('MemberDetail', { membershipId: m.membershipId })}
                actions={
                  m.phone ? (
                    <CircleButton
                      icon="call"
                      onPress={() => void Linking.openURL(`tel:${m.phone}`)}
                    />
                  ) : undefined
                }
              />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
