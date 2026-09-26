import type { Notification } from '@movo/contracts';
import { Card, EmptyState, IconSquare, Row, Screen, Skeleton, TitleBar } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { useNav } from '../../core/navigation/types';
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

  const open = (n: Notification) => {
    const data = n.data as {
      screen?: string;
      noticeId?: string;
      alertId?: string;
      meetingId?: string;
      eventId?: string;
      billId?: string;
      paymentId?: string;
      expenseId?: string;
    };
    if (data.screen === 'notice' && data.noticeId)
      nav.navigate('NoticeDetail', { noticeId: data.noticeId });
    else if (data.screen === 'alert' && data.alertId)
      nav.navigate('AlertDetail', { alertId: data.alertId });
    else if (data.screen === 'meeting' && data.meetingId)
      nav.navigate('MeetingDetail', { meetingId: data.meetingId });
    else if (data.screen === 'event' && data.eventId)
      nav.navigate('EventDetail', { eventId: data.eventId });
    else if (data.screen === 'bill' && data.billId) nav.navigate('Bill', { billId: data.billId });
    else if (data.screen === 'payment' && data.paymentId)
      nav.navigate('Receipt', { paymentId: data.paymentId });
    else if (data.screen === 'expense' && data.expenseId)
      nav.navigate('ExpenseDetail', { expenseId: data.expenseId });
    else if (data.screen === 'manage/join-requests') nav.navigate('JoinRequests');
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
        <EmptyState icon="bell" title={t('common:states.empty')} className="mt-10" />
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
