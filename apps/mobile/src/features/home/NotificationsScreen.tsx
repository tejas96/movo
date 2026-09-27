import type { Notification } from '@movo/contracts';
import {
  Card,
  EmptyState,
  IconSquare,
  photos,
  Row,
  Screen,
  Skeleton,
  TitleBar,
} from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { openNotificationTarget, switchSocietyFor } from '../../core/notifications/open-target';
import { useMeContext } from '../../core/tenant/hooks';
import { relative } from '../../core/util/time';
import { useMarkAllRead, useNotifications } from './api';

const ICONS = {
  NOTICE: 'notices',
  MEETING: 'meetings',
  EVENT: 'events',
  TASK: 'tasks',
  DUTY: 'duties',
  MAINTENANCE: 'money',
  EXPENSE: 'receipt',
  EMERGENCY: 'emergency',
  MARKETPLACE: 'market',
  MEMBERSHIP: 'people',
  SYSTEM: 'info',
} as const;

export function NotificationsScreen() {
  const { t } = useTranslation(['me', 'common']);
  const nav = useNav();
  const list = useNotifications();
  const markAll = useMarkAllRead();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  const ctx = useMeContext();
  const activeSocietyIds =
    ctx.data?.memberships.filter((m) => m.status === 'ACTIVE').map((m) => m.society.id) ?? [];

  const open = (n: Notification) => {
    switchSocietyFor({ ...n.data, societyId: n.societyId }, activeSocietyIds);
    openNotificationTarget(nav, n.data);
  };

  return (
    <Screen scroll={false}>
      <TitleBar
        title={t('me:notifications')}
        onBack={() => nav.goBack()}
        trailing={
          <IconSquare icon="checkSquare" variant="linear" onPress={() => markAll.mutate()} />
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
          icon="bell"
          title={t('common:states.empty')}
          className="mt-10"
        />
      ) : (
        <FlatList
          className="mt-4"
          data={items}
          keyExtractor={(n) => n.id}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          refreshing={list.isRefetching}
          onRefresh={() => void list.refetch()}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Card tight className="mb-2">
              <Row
                icon={ICONS[item.category]}
                title={item.title}
                subtitle={`${item.body}${item.body ? ' · ' : ''}${relative(item.createdAt)}`}
                trailing={
                  !item.readAt ? <View className="h-2 w-2 rounded-full bg-ink" /> : <View />
                }
                onPress={() => open(item)}
              />
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
