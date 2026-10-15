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
} from '@movo/design-system';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { PagedList } from '../../core/ui/PagedList';
import { StatusPill, type StatusTones } from '../../core/ui/StatusPill';
import { relative } from '../../core/util/date';
import { useNotices } from './api';

/** NORMAL shows no pill. */
export const PRIORITY_TONE: StatusTones<NoticeSummary['priority']> = {
  NORMAL: 'neutral',
  IMPORTANT: 'warning',
  EMERGENCY: 'danger',
};

type Tab = 'PUBLISHED' | 'DRAFT';

const keyOf = (n: NoticeSummary) => n.id;

const NoticeRow = memo(function NoticeRow({ item }: { item: NoticeSummary }) {
  const { t } = useTranslation(['notices', 'common']);
  const nav = useNav();
  const subtitle = [
    item.isPinned ? t('notices:pinned') : null,
    t(`notices:category.${item.category}`),
    relative(item.publishedAt),
    item.createdBy.displayName,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card tight className="mb-2">
      <Row
        icon={item.priority === 'EMERGENCY' ? 'emergency' : 'notices'}
        title={item.title}
        subtitle={subtitle}
        trailing={
          item.priority !== 'NORMAL' ? (
            <StatusPill value={item.priority} tones={PRIORITY_TONE} labels="notices:priority" />
          ) : !item.readAt && item.status === 'PUBLISHED' ? (
            <View className="h-2 w-2 rounded-full bg-ink" />
          ) : undefined
        }
        onPress={() => nav.navigate('NoticeDetail', { noticeId: item.id })}
      />
    </Card>
  );
});

export function NoticesScreen() {
  const { t } = useTranslation(['notices', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const canPublish = useCan('notice.publish');
  const [tab, setTab] = useState<Tab>('PUBLISHED');
  const list = useNotices(societyId, tab);

  const renderItem = useCallback(
    ({ item }: { item: NoticeSummary }) => <NoticeRow item={item} />,
    [],
  );

  return (
    <Screen scroll={false}>
      <PagedList
        list={list}
        keyExtractor={keyOf}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={renderItem}
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
        errorClassName="mt-6"
        empty={
          <EmptyState
            icon="notices"
            photo={photos.empty}
            title={t('notices:empty')}
            body={t('notices:emptyBody')}
            className="mt-6"
          />
        }
      />
    </Screen>
  );
}
