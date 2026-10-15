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
import { View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { openNotificationTarget, switchSocietyFor } from '../../core/notifications/open-target';
import { useMeContext } from '../../core/tenant/hooks';
import { PagedList } from '../../core/ui/PagedList';
import { relative } from '../../core/util/date';
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
            icon="bell"
            title={t('common:states.empty')}
            className="mt-10"
          />
        }
        className="mt-4"
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Card tight className="mb-2">
            <Row
              icon={ICONS[item.category]}
              title={item.title}
              subtitle={`${item.body}${item.body ? ' · ' : ''}${relative(item.createdAt)}`}
              trailing={!item.readAt ? <View className="h-2 w-2 rounded-full bg-ink" /> : <View />}
              onPress={() => open(item)}
            />
          </Card>
        )}
      />
    </Screen>
  );
}
