import type { ListingReport } from '@movo/contracts';
import {
  Button,
  EmptyState,
  Input,
  photos,
  Row,
  Screen,
  Sheet,
  Skeleton,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { relative } from '../../core/util/time';
import { useDismissReport, useListingAction, useMarketReports } from './api';
import { priceLabel, Thumb } from './shared';

export function MarketReportsScreen() {
  const { t } = useTranslation(['market', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const canModerate = useCan('marketplace.moderate');
  const list = useMarketReports(societyId, canModerate);
  const hide = useListingAction(societyId);
  const dismiss = useDismissReport(societyId);
  const [hiding, setHiding] = useState<ListingReport | null>(null);
  const [reason, setReason] = useState('');
  const items = list.data ?? [];

  const doHide = async () => {
    if (!hiding) return;
    try {
      await hide.mutateAsync({
        listingId: hiding.listing.id,
        action: { kind: 'hide', reason: reason.trim() },
      });
      toast.show(t('market:listing.hidden'));
      setHiding(null);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };
  const doDismiss = async (id: string) => {
    try {
      await dismiss.mutateAsync(id);
      toast.show(t('market:reports.dismissed'));
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <TitleBar title={t('market:reports.title')} onBack={() => nav.goBack()} />
      {list.isLoading ? (
        <Skeleton className="mt-6 h-40 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState
          photo={photos.empty}
          icon="flag"
          title={t('market:reports.empty')}
          body={t('market:reports.emptyBody')}
          className="mt-10"
        />
      ) : (
        <View className="mt-6 gap-3">
          {items.map((r) => (
            <View key={r.id} className="rounded-xl bg-card p-2">
              <Row
                onGray
                leading={<Thumb cover={r.listing.cover} kind={r.listing.kind} />}
                title={r.listing.title}
                subtitle={[r.listing.seller.displayName, priceLabel(r.listing)]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => nav.navigate('Listing', { listingId: r.listing.id })}
              />
              <View className="px-3 pb-2 pt-3">
                <Text variant="body">{r.reason}</Text>
                <Text variant="label" tone="secondary" className="mt-1">
                  {t('market:reports.reportedBy', {
                    name: r.reportedBy,
                    time: relative(r.createdAt),
                  })}
                </Text>
                <View className="mt-3 flex-row gap-2">
                  <Button
                    label={t('market:listing.hide')}
                    size="sm"
                    inline
                    onPress={() => {
                      setReason('');
                      setHiding(r);
                    }}
                  />
                  <Button
                    label={t('market:reports.dismiss')}
                    variant="white"
                    size="sm"
                    inline
                    loading={dismiss.isPending && dismiss.variables === r.id}
                    onPress={() => void doDismiss(r.id)}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
      <Sheet
        visible={hiding !== null}
        onClose={() => setHiding(null)}
        title={t('market:listing.hideTitle')}
        footer={
          <Button
            label={t('market:listing.hide')}
            variant="danger"
            loading={hide.isPending}
            disabled={reason.trim().length < 2}
            onPress={() => void doHide()}
          />
        }
      >
        <Input
          white
          multiline
          label={t('market:listing.hideReason')}
          helper={t('market:listing.hideHelp')}
          value={reason}
          onChangeText={setReason}
          maxLength={300}
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />
      </Sheet>
    </Screen>
  );
}
