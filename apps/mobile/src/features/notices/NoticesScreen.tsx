import type { NoticeSummary } from '@movo/contracts';
import {
  Card,
  EmptyState,
  IconSquare,
  ModuleHeader,
  photos,
  Row,
  Screen,
  Segmented,
  Skeleton,
  StatusPill,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { relative } from '../../core/util/time';
import { useNotices } from './api';

type Tab = 'PUBLISHED' | 'DRAFT';

export function NoticesScreen() {
  const { t } = useTranslation(['notices', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const canPublish = useCan('notice.publish');
  const [tab, setTab] = useState<Tab>('PUBLISHED');
  const list = useNotices(societyId, tab);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  const subtitle = (n: NoticeSummary) =>
    [
      n.isPinned ? t('notices:pinned') : null,
      t(`notices:category.${n.category}`),
      relative(n.publishedAt),
      n.createdBy.displayName,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
        refreshing={list.isRefetching}
        onRefresh={() => void list.refetch()}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Card tight className="mb-2">
            <Row
              icon={item.priority === 'EMERGENCY' ? 'emergency' : 'notices'}
              title={item.title}
              subtitle={subtitle(item)}
              trailing={
                item.priority !== 'NORMAL' ? (
                  <StatusPill
                    label={t(`notices:priority.${item.priority}`)}
                    tone={item.priority === 'EMERGENCY' ? 'danger' : 'warning'}
                  />
                ) : !item.readAt && item.status === 'PUBLISHED' ? (
                  <View className="h-2 w-2 rounded-full bg-ink" />
                ) : undefined
              }
              onPress={() => nav.navigate('NoticeDetail', { noticeId: item.id })}
            />
          </Card>
        )}
        ListHeaderComponent={
          <View className="mb-4">
            <ModuleHeader
              source={photos.notices}
              title={t('notices:title')}
              onBack={() => nav.goBack()}
              trailing={
                canPublish ? (
                  <IconSquare
                    icon="add"
                    variant="linear"
                    tone="ink"
                    onPress={() => nav.navigate('NoticeEditor')}
                  />
                ) : undefined
              }
            />
            {canPublish ? (
              <Segmented
                className="mt-4"
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'PUBLISHED', label: t('notices:title') },
                  { value: 'DRAFT', label: t('notices:drafts') },
                ]}
              />
            ) : null}
            {list.isLoading ? (
              <View className="mt-4 gap-3">
                <Skeleton className="h-[68px]" />
                <Skeleton className="h-[68px]" />
                <Skeleton className="h-[68px]" />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          list.isLoading ? undefined : (
            <EmptyState
              icon="notices"
              photo={photos.empty}
              title={t('notices:empty')}
              body={t('notices:emptyBody')}
              className="mt-6"
            />
          )
        }
      />
    </Screen>
  );
}
