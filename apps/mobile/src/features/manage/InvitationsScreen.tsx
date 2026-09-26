import type { Invitation } from '@movo/contracts';
import {
  Card,
  EmptyState,
  IconSquare,
  OptionSheet,
  photos,
  Row,
  Screen,
  Skeleton,
  StatusPill,
  TitleBar,
  useToast,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Share, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId, useTenant } from '../../core/tenant/hooks';
import { shortDate } from '../../core/util/time';
import { useInvitations, useRevokeInvitation } from './api';

const TONE = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  EXPIRED: 'neutral',
  REVOKED: 'neutral',
} as const;

export function InvitationsScreen() {
  const { t } = useTranslation(['manage', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const list = useInvitations(societyId);
  const revoke = useRevokeInvitation(societyId);
  const [selected, setSelected] = useState<Invitation | null>(null);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  const share = (inv: Invitation) =>
    void Share.share({
      message: t('manage:invite.shareText', { society: tenant.society.name, code: inv.code }),
    });
  const act = async (value: 'share' | 'revoke') => {
    if (!selected) return;
    if (value === 'share') return share(selected);
    try {
      await revoke.mutateAsync(selected.id);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen scroll={false}>
      <TitleBar
        title={t('manage:invitations')}
        onBack={() => nav.goBack()}
        trailing={
          <IconSquare
            icon="add"
            variant="linear"
            tone="ink"
            onPress={() => nav.navigate('InviteMember')}
          />
        }
      />
      {list.isLoading ? (
        <View className="mt-4 gap-3">
          <Skeleton className="h-[68px]" />
          <Skeleton className="h-[68px]" />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          photo={photos.empty}
          icon="send"
          title={t('manage:invite.empty')}
          body={t('manage:invite.emptyBody')}
          actionLabel={t('manage:invite.title')}
          onAction={() => nav.navigate('InviteMember')}
          className="mt-10"
        />
      ) : (
        <FlatList
          className="mt-4"
          data={items}
          keyExtractor={(i) => i.id}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          refreshing={list.isRefetching}
          onRefresh={() => void list.refetch()}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Card tight className="mb-2">
              <Row
                icon="send"
                title={`${item.inviteeName} · ${item.code}`}
                subtitle={[
                  item.flat
                    ? item.flat.buildingName
                      ? `${item.flat.buildingName}-${item.flat.number}`
                      : item.flat.number
                    : t('manage:invite.noFlat'),
                  item.role.name,
                  t('manage:invite.expires', { date: shortDate(item.expiresAt) }),
                ].join(' · ')}
                trailing={
                  <StatusPill label={t(`common:status.${item.status}`)} tone={TONE[item.status]} />
                }
                onPress={item.status === 'PENDING' ? () => setSelected(item) : undefined}
              />
            </Card>
          )}
        />
      )}
      <OptionSheet
        visible={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.inviteeName} · ${selected.code}` : undefined}
        options={[
          { value: 'share', label: t('common:actions.share') },
          { value: 'revoke', label: t('manage:invite.revoke') },
        ]}
        onSelect={(v) => void act(v)}
      />
    </Screen>
  );
}
