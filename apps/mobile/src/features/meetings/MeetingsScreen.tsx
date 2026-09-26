import type { MeetingStatus, Timeframe } from '@movo/contracts';
import {
  EmptyState,
  IconSquare,
  Screen,
  Segmented,
  Skeleton,
  StatusPill,
  TitleBar,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { TimedCard } from '../calendar/shared';
import { useMeetings } from './api';

export function MeetingStatusPill({ status }: { status: MeetingStatus }) {
  const { t } = useTranslation('meetings');
  if (status === 'SCHEDULED') return null;
  return (
    <StatusPill
      label={t(`status.${status}`)}
      tone={status === 'CANCELLED' ? 'danger' : 'neutral'}
    />
  );
}

export function MeetingsScreen() {
  const { t } = useTranslation(['meetings', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const canManage = useCan('meeting.manage');
  const [when, setWhen] = useState<Timeframe>('UPCOMING');
  const list = useMeetings(societyId, when);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen scroll={false}>
      <TitleBar
        title={t('meetings:title')}
        onBack={() => nav.goBack()}
        trailing={
          canManage ? (
            <IconSquare
              icon="add"
              variant="linear"
              tone="ink"
              onPress={() => nav.navigate('MeetingEditor')}
            />
          ) : undefined
        }
      />
      <Segmented
        className="mt-4"
        value={when}
        onChange={setWhen}
        options={[
          { value: 'UPCOMING', label: t('meetings:upcoming') },
          { value: 'PAST', label: t('meetings:past') },
        ]}
      />
      {list.isLoading ? (
        <View className="mt-4 gap-3">
          <Skeleton className="h-[84px]" />
          <Skeleton className="h-[84px]" />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="meetings"
          title={when === 'UPCOMING' ? t('meetings:empty') : t('meetings:emptyPast')}
          body={when === 'UPCOMING' ? t('meetings:emptyBody') : undefined}
          className="mt-10"
        />
      ) : (
        <FlatList
          className="mt-4"
          data={items}
          keyExtractor={(m) => m.id}
          onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
          refreshing={list.isRefetching}
          onRefresh={() => void list.refetch()}
          contentContainerStyle={{ paddingBottom: 40, gap: 8 }}
          renderItem={({ item }) => (
            <TimedCard
              startsAt={item.startsAt}
              endsAt={item.endsAt}
              title={item.title}
              location={item.location}
              dimmed={item.status === 'CANCELLED'}
              pill={<MeetingStatusPill status={item.status} />}
              onPress={() => nav.navigate('MeetingDetail', { meetingId: item.id })}
            />
          )}
        />
      )}
    </Screen>
  );
}
