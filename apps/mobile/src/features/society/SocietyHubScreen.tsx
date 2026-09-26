import type { ModuleKey } from '@movo/contracts';
import {
  CircleButton,
  type IconName,
  IconSquare,
  PersonCard,
  Screen,
  SectionHeader,
  Tile,
  TitleBar,
} from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useCan, useTenant } from '../../core/tenant/hooks';
import { useMembers } from '../directory/api';
import { useSocietyProfile } from './api';

type HubKey = ModuleKey | 'manage';
type ModuleTile = { key: HubKey; icon: IconName; labelKey: string };

const ORDER: ModuleTile[] = [
  { key: 'notices', icon: 'notices', labelKey: 'notices' },
  { key: 'meetings', icon: 'meetings', labelKey: 'meetings' },
  { key: 'events', icon: 'events', labelKey: 'events' },
  { key: 'directory', icon: 'directory', labelKey: 'directory' },
  { key: 'vendors', icon: 'services', labelKey: 'vendors' },
  { key: 'parking', icon: 'parking', labelKey: 'parking' },
  { key: 'tasks', icon: 'tasks', labelKey: 'tasks' },
  { key: 'responsibilities', icon: 'duties', labelKey: 'responsibilities' },
  { key: 'rewards', icon: 'rewards', labelKey: 'rewards' },
  { key: 'expenses', icon: 'receipt', labelKey: 'expenses' },
  { key: 'emergency', icon: 'emergency', labelKey: 'emergency' },
];

const COMMITTEE_ROLES = new Set(['admin', 'committee', 'treasurer']);
const PADS = ['pad-a', 'pad-b'] as const;

export function SocietyHubScreen() {
  const { t } = useTranslation(['society', 'common']);
  const nav = useNav();
  const tenant = useTenant();
  const profile = useSocietyProfile(tenant.society.id);
  const canManageMembers = useCan('member.manage');
  const canManageSettings = useCan('society.settings.manage');
  const canManage = canManageMembers || canManageSettings;
  const members = useMembers(tenant.society.id, '');
  const enabled = new Set(tenant.modules.filter((m) => m.enabled).map((m) => m.key));
  const tiles: ModuleTile[] = [
    ...ORDER.filter((m) => enabled.has(m.key as ModuleKey)),
    ...(canManage ? [{ key: 'manage', icon: 'settings', labelKey: 'manage' } as ModuleTile] : []),
  ];
  const committee = (members.data?.pages.flatMap((p) => p.items) ?? [])
    .filter((m) => m.roles.some((r) => COMMITTEE_ROLES.has(r.key)))
    .slice(0, 3);

  const open = (tile: ModuleTile) => {
    const title = t(`society:modules.${tile.labelKey}` as 'society:modules.notices');
    if (tile.key === 'notices') nav.navigate('Notices');
    else if (tile.key === 'directory') nav.navigate('Directory');
    else if (tile.key === 'vendors') nav.navigate('Services');
    else if (tile.key === 'parking') nav.navigate('Parking');
    else if (tile.key === 'emergency') nav.navigate('Emergency');
    else if (tile.key === 'manage') nav.navigate('Manage');
    else nav.navigate('ComingSoon', { moduleKey: tile.key, title });
  };

  const rows: ModuleTile[][] = [];
  for (let i = 0; i < tiles.length; i += 3) rows.push(tiles.slice(i, i + 3));

  return (
    <Screen tabBar refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()}>
      <TitleBar
        large
        title={tenant.society.name}
        subtitle={
          profile.data
            ? t('society:flatsAndWings', {
                flats: profile.data.counts.flats,
                wings: profile.data.counts.buildings,
              })
            : (tenant.society.city ?? undefined)
        }
        trailing={
          <IconSquare icon="search" variant="linear" onPress={() => nav.navigate('Directory')} />
        }
      />
      <View className="mt-5 gap-3">
        {rows.map((row) => (
          <View key={row.map((r) => r.key).join('-')} className="flex-row gap-3">
            {row.map((tile) => (
              <Tile
                key={tile.key}
                icon={tile.icon}
                label={t(`society:modules.${tile.labelKey}` as 'society:modules.notices')}
                onPress={() => open(tile)}
              />
            ))}
            {row.length < 3
              ? PADS.slice(0, 3 - row.length).map((pad) => <View key={pad} className="flex-1" />)
              : null}
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
                avatarUri={m.avatarUrl}
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
