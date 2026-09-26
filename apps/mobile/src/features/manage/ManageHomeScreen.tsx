import {
  Button,
  Card,
  type IconName,
  Screen,
  Text,
  Tile,
  TitleBar,
  useToast,
} from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { Share, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useCan, useModuleEnabled, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { useHomeSummary } from '../home/api';
import { useSocietyProfile } from '../society/api';
import { useRotateJoinCode } from './api';

/** Keeps the last row's tiles the same width as the rows above. */
const PADS = ['pad-a', 'pad-b'] as const;

interface ManageTile {
  key: string;
  icon: IconName;
  label: string;
  hint?: string | undefined;
  count?: number | undefined;
  onPress: () => void;
}

export function ManageHomeScreen() {
  const { t } = useTranslation(['manage', 'common', 'society']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const profile = useSocietyProfile(societyId);
  const summary = useHomeSummary(societyId);
  const rotate = useRotateJoinCode(societyId);
  const parkingOn = useModuleEnabled('parking');
  const canParking = useCan('parking.manage');
  const canMembers = useCan('member.manage');
  const canStructure = useCan('society.structure.manage');
  const canSettings = useCan('society.settings.manage');
  const canRoles = useCan('society.roles.manage');
  const canAudit = useCan('audit.view');
  const pending = summary.data?.attention.find((a) => a.type === 'JOIN_REQUESTS_PENDING');
  const joinCode = profile.data?.joinCode;
  const p = profile.data;

  const tiles = (
    [
      canMembers && {
        key: 'members',
        icon: 'people',
        label: t('manage:tiles.members'),
        hint: p ? String(p.counts.members) : undefined,
        onPress: () => nav.navigate('Directory', { manage: true }),
      },
      canMembers && {
        key: 'invitations',
        icon: 'send',
        label: t('manage:tiles.invitations'),
        onPress: () => nav.navigate('Invitations'),
      },
      canMembers && {
        key: 'requests',
        icon: 'userAdd',
        label: t('manage:tiles.requests'),
        count: pending && pending.type === 'JOIN_REQUESTS_PENDING' ? pending.count : undefined,
        onPress: () => nav.navigate('JoinRequests'),
      },
      canStructure && {
        key: 'structure',
        icon: 'building',
        label: t('manage:tiles.structure'),
        hint: p
          ? t('society:flatsAndWings', { flats: p.counts.flats, wings: p.counts.buildings })
          : undefined,
        onPress: () => nav.navigate('Structure'),
      },
      parkingOn &&
        canParking && {
          key: 'parking',
          icon: 'parking',
          label: t('manage:tiles.parking'),
          onPress: () => nav.navigate('ParkingSlots'),
        },
      canSettings && {
        key: 'profile',
        icon: 'flat',
        label: t('manage:tiles.profile'),
        onPress: () => nav.navigate('SocietyProfile'),
      },
      canSettings && {
        key: 'modules',
        icon: 'settings',
        label: t('manage:tiles.modules'),
        onPress: () => nav.navigate('Modules'),
      },
      canRoles && {
        key: 'roles',
        icon: 'shield',
        label: t('manage:tiles.roles'),
        onPress: () => nav.navigate('Roles'),
      },
      canAudit && {
        key: 'audit',
        icon: 'audit',
        label: t('manage:tiles.audit'),
        onPress: () => nav.navigate('AuditLog'),
      },
    ] as (ManageTile | false)[]
  ).filter((x): x is ManageTile => Boolean(x));
  const rows = Array.from({ length: Math.ceil(tiles.length / 3) }, (_, i) =>
    tiles.slice(i * 3, i * 3 + 3),
  );

  const share = () => {
    if (!joinCode) return;
    void Share.share({
      message: `${t('manage:joinCodeHelp')}\n\n${tenant.society.name}: ${joinCode}`,
    });
  };
  const newCode = async () => {
    try {
      await rotate.mutateAsync();
      toast.show(t('common:actions.done'));
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => void profile.refetch()}>
      <TitleBar title={t('manage:title')} onBack={() => nav.goBack()} />
      {rows.map((row, i) => (
        <View
          key={row.map((r) => r.key).join()}
          className={i === 0 ? 'mt-6 flex-row gap-3' : 'mt-3 flex-row gap-3'}
        >
          {row.map((tile) => (
            <Tile
              key={tile.key}
              icon={tile.icon}
              label={tile.label}
              hint={tile.hint}
              count={tile.count}
              onPress={tile.onPress}
            />
          ))}
          {PADS.slice(0, 3 - row.length).map((pad) => (
            <View key={pad} className="flex-1" />
          ))}
        </View>
      ))}

      {canMembers ? (
        <Card className="mt-6">
          <Text variant="label" tone="secondary">
            {t('manage:joinCode')}
          </Text>
          <Text variant="display" className="mt-1 tracking-[6px]">
            {joinCode ?? '——'}
          </Text>
          <Text variant="label" tone="secondary" className="mt-2">
            {t('manage:joinCodeHelp')}
          </Text>
          <View className="mt-4 flex-row gap-2">
            <Button
              label={t('common:actions.share')}
              icon="share"
              inline
              size="sm"
              onPress={share}
              disabled={!joinCode}
            />
            <Button
              label={t('manage:rotateJoinCode')}
              variant="white"
              inline
              size="sm"
              onPress={() => void newCode()}
              loading={rotate.isPending}
            />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
