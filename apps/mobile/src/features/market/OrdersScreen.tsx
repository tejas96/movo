import type { OrderRole, OrderSummary } from '@movo/contracts';
import {
  Card,
  EmptyState,
  photos,
  Row,
  Screen,
  Segmented,
  Skeleton,
  TitleBar,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { money } from '../../core/util/money';
import { useHomeSummary } from '../home/api';
import { useOrders } from './api';
import { OrderStatusPill, Thumb } from './shared';

export function OrdersScreen() {
  const { t } = useTranslation(['market', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const summary = useHomeSummary(societyId);
  const initial = useRoute<RouteProp<RootStackParamList, 'Orders'>>().params?.role;
  const waiting = summary.data?.attention.some((a) => a.type === 'MARKET_ORDERS_WAITING');
  const [role, setRole] = useState<OrderRole>(initial ?? (waiting ? 'SELLING' : 'BUYING'));
  const list = useOrders(societyId, role);
  const items = list.data ?? [];

  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <TitleBar title={t('market:orders.title')} onBack={() => nav.goBack()} />
      <Segmented
        className="mt-4"
        value={role}
        onChange={setRole}
        options={[
          { value: 'BUYING', label: t('market:orders.buying') },
          { value: 'SELLING', label: t('market:orders.selling') },
        ]}
      />
      {list.isLoading ? (
        <Skeleton className="mt-4 h-40 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState
          photo={photos.market}
          icon="receipt"
          title={
            role === 'BUYING' ? t('market:orders.emptyBuying') : t('market:orders.emptySelling')
          }
          className="mt-8"
        />
      ) : (
        <Card tight className="mt-4 gap-2">
          {items.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

function OrderRow({ order: o }: { order: OrderSummary }) {
  const { t } = useTranslation('market');
  const nav = useNav();
  return (
    <Row
      leading={<Thumb cover={o.listing.cover} kind={o.listing.kind} />}
      title={o.listing.title}
      subtitle={[
        o.counterpart.displayName,
        t('orders.qty', { count: o.quantity }),
        o.totalPaise != null ? money(o.totalPaise) : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      trailing={
        <View className="items-end gap-1.5">
          <OrderStatusPill status={o.status} />
          {o.unreadMessages > 0 ? <View className="h-2 w-2 rounded-full bg-ink" /> : null}
        </View>
      }
      onPress={() => nav.navigate('OrderDetail', { orderId: o.id })}
    />
  );
}
