import { Card, EmptyState, IconSquare, Screen, Skeleton, TitleBar } from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { useVendors } from './api';
import { VendorRow } from './shared';

export function VendorListScreen() {
  const { t } = useTranslation(['services', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const { categoryId, status, title } =
    useRoute<RouteProp<RootStackParamList, 'VendorList'>>().params;
  const canManage = useCan('vendor.manage');
  const list = useVendors(societyId, {
    ...(categoryId ? { categoryId } : {}),
    ...(status ? { status } : {}),
  });
  const items = list.data ?? [];

  return (
    <Screen scroll={false}>
      <TitleBar
        title={title}
        onBack={() => nav.goBack()}
        trailing={
          categoryId ? (
            <IconSquare
              icon="add"
              variant="linear"
              accessibilityLabel={canManage ? t('services:add') : t('services:suggest')}
              onPress={() => nav.navigate('VendorEditor', { categoryId })}
            />
          ) : undefined
        }
      />
      {list.isLoading ? (
        <View className="mt-4 gap-3">
          <Skeleton className="h-[68px]" />
          <Skeleton className="h-[68px]" />
          <Skeleton className="h-[68px]" />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="services"
          title={t('services:empty')}
          body={t('services:emptyBody')}
          className="mt-10"
        />
      ) : (
        <FlatList
          className="mt-4"
          data={items}
          keyExtractor={(v) => v.id}
          refreshing={list.isRefetching}
          onRefresh={() => void list.refetch()}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Card tight className="mb-2">
              <VendorRow vendor={item} showCategory={!categoryId} />
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
