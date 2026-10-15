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
  TitleBar,
} from '@movo/design-system';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, View } from 'react-native';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { useNav } from '../../core/navigation/types';
import { useSocietyId, useTenant } from '../../core/tenant/hooks';
import { PagedList } from '../../core/ui/PagedList';
import { StatusPill, type StatusTones } from '../../core/ui/StatusPill';
import { shortDate } from '../../core/util/date';
import { useInvitations, useRevokeInvitation } from './api';

const TONE: StatusTones<Invitation['status']> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  EXPIRED: 'neutral',
  REVOKED: 'neutral',
};

const keyOf = (i: Invitation) => i.id;

const InvitationRow = memo(function InvitationRow({
  item,
  onSelect,
}: {
  item: Invitation;
  onSelect: (inv: Invitation) => void;
}) {
  const { t } = useTranslation(['manage', 'common']);
  return (
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
        trailing={<StatusPill value={item.status} tones={TONE} labels="common:status" />}
        onPress={item.canRevoke ? () => onSelect(item) : undefined}
      />
    </Card>
  );
});

export function InvitationsScreen() {
  const { t } = useTranslation(['manage', 'common']);
  const nav = useNav();
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const list = useInvitations(societyId);
  const revoke = useRevokeInvitation(societyId);
  const [selected, setSelected] = useState<Invitation | null>(null);
  const renderItem = useCallback(
    ({ item }: { item: Invitation }) => <InvitationRow item={item} onSelect={setSelected} />,
    [],
  );

  const share = (inv: Invitation) =>
    void Share.share({
      message: t('manage:invite.shareText', { society: tenant.society.name, code: inv.code }),
    });
  const act = async (value: 'share' | 'revoke') => {
    if (!selected) return;
    if (value === 'share') return share(selected);
    await withErrorToast(async () => {
      await revoke.mutateAsync(selected.id);
    });
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
      <PagedList
        list={list}
        loading={
          <View className="mt-4 gap-3">
            <Skeleton className="h-[68px]" />
            <Skeleton className="h-[68px]" />
          </View>
        }
        errorClassName="mt-10"
        empty={
          <EmptyState
            photo={photos.empty}
            icon="send"
            title={t('manage:invite.empty')}
            body={t('manage:invite.emptyBody')}
            actionLabel={t('manage:invite.title')}
            onAction={() => nav.navigate('InviteMember')}
            className="mt-10"
          />
        }
        className="mt-4"
        keyExtractor={keyOf}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={renderItem}
      />
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
