import { Button, Card, Screen, Text, Tile, TitleBar, useToast } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { Share, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId, useTenant } from '../../core/tenant/hooks';
import { useHomeSummary } from '../home/api';
import { useSocietyProfile } from '../society/api';
import { useRotateJoinCode } from './api';

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
  const pending = summary.data?.attention.find((a) => a.type === 'JOIN_REQUESTS_PENDING');
  const joinCode = profile.data?.joinCode;

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
      <View className="mt-6 flex-row gap-3">
        <Tile
          icon="people"
          label={t('manage:tiles.members')}
          hint={profile.data ? String(profile.data.counts.members) : undefined}
          onPress={() => nav.navigate('Directory', { manage: true })}
        />
        <Tile
          icon="send"
          label={t('manage:tiles.invitations')}
          onPress={() => nav.navigate('Invitations')}
        />
        <Tile
          icon="userAdd"
          label={t('manage:tiles.requests')}
          count={pending && pending.type === 'JOIN_REQUESTS_PENDING' ? pending.count : undefined}
          onPress={() => nav.navigate('JoinRequests')}
        />
      </View>
      <View className="mt-3 flex-row gap-3">
        <Tile
          icon="building"
          label={t('manage:tiles.structure')}
          hint={
            profile.data
              ? t('society:flatsAndWings', {
                  flats: profile.data.counts.flats,
                  wings: profile.data.counts.buildings,
                })
              : undefined
          }
          onPress={() => nav.navigate('Structure')}
        />
        <View className="flex-1" />
        <View className="flex-1" />
      </View>

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
    </Screen>
  );
}
