import { EmptyState, Screen, Skeleton, TitleBar } from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { usePayments } from './api';
import { PaymentRow } from './shared';

export function PaymentsScreen() {
  const { t } = useTranslation('money');
  const nav = useNav();
  const societyId = useSocietyId();
  const flatId = useRoute<RouteProp<RootStackParamList, 'Payments'>>().params?.flatId;
  const viewAll = useCan('maintenance.view_all');
  const list = usePayments(societyId, flatId);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Screen scroll={false}>
      <TitleBar title={t('allPayments')} onBack={() => nav.goBack()} />
      {list.isLoading ? (
        <View className="mt-4 gap-3">
          <Skeleton className="h-[68px]" />
          <Skeleton className="h-[68px]" />
        </View>
      ) : items.length === 0 ? (
        <EmptyState icon="receipt" title={t('noPayments')} className="mt-10" />
      ) : (
        <FlatList
          className="mt-4"
          data={items}
          keyExtractor={(p) => p.id}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          refreshing={list.isRefetching}
          onRefresh={() => void list.refetch()}
          contentContainerStyle={{ paddingBottom: 40, gap: 4 }}
          renderItem={({ item }) => <PaymentRow payment={item} showFlat={viewAll && !flatId} />}
        />
      )}
    </Screen>
  );
}
