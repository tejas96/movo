import { EmptyState, photos, Screen, Skeleton, TitleBar } from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { PagedList } from '../../core/ui/PagedList';
import { usePayments } from './api';
import { PaymentRow } from './shared';

export function PaymentsScreen() {
  const { t } = useTranslation('money');
  const nav = useNav();
  const societyId = useSocietyId();
  const flatId = useRoute<RouteProp<RootStackParamList, 'Payments'>>().params?.flatId;
  const viewAll = useCan('maintenance.view_all');
  const list = usePayments(societyId, flatId);
  return (
    <Screen scroll={false}>
      <TitleBar title={t('allPayments')} onBack={() => nav.goBack()} />
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
            icon="receipt"
            title={t('noPayments')}
            className="mt-10"
          />
        }
        className="mt-4"
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: 40, gap: 4 }}
        renderItem={({ item }) => <PaymentRow payment={item} showFlat={viewAll && !flatId} />}
      />
    </Screen>
  );
}
