import type { EventSummary, Timeframe } from '@movo/contracts';
import {
  EmptyState,
  IconSquare,
  ModuleHeader,
  photos,
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
import { TimedCard } from '../calendar/shared';
import { useEvents } from './api';

export function EventPill({ event }: { event: Pick<EventSummary, 'status' | 'myRsvp'> }) {
  const { t } = useTranslation('events');
  if (event.status === 'CANCELLED')
    return <StatusPill label={t('status.CANCELLED')} tone="danger" />;
  if (event.myRsvp?.response === 'GOING')
    return <StatusPill label={t('rsvp.GOING')} tone="success" dot />;
  if (event.myRsvp?.response === 'MAYBE')
    return <StatusPill label={t('rsvp.MAYBE')} tone="warning" />;
  return null;
}

export function EventsScreen() {
  const { t } = useTranslation(['events', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const canManage = useCan('event.manage');
  const [when, setWhen] = useState<Timeframe>('UPCOMING');
  const list = useEvents(societyId, when);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
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
            meta={
              item.rsvpEnabled && item.goingCount > 0 && item.status !== 'CANCELLED'
                ? t('events:going', { count: item.goingCount })
                : undefined
            }
            dimmed={item.status === 'CANCELLED'}
            pill={<EventPill event={item} />}
            onPress={() => nav.navigate('EventDetail', { eventId: item.id })}
          />
        )}
        ListHeaderComponent={
          <View className="mb-4">
            <ModuleHeader
              source={photos.events}
              title={t('events:title')}
              onBack={() => nav.goBack()}
              trailing={
                canManage ? (
                  <IconSquare
                    icon="add"
                    variant="linear"
                    tone="ink"
                    onPress={() => nav.navigate('EventEditor')}
                  />
                ) : undefined
              }
            />
            <Segmented
              className="mt-4"
              value={when}
              onChange={setWhen}
              options={[
                { value: 'UPCOMING', label: t('events:upcoming') },
                { value: 'PAST', label: t('events:past') },
              ]}
            />
            {list.isLoading ? (
              <View className="mt-4 gap-3">
                <Skeleton className="h-[84px]" />
                <Skeleton className="h-[84px]" />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          list.isLoading ? undefined : (
            <EmptyState
              icon="events"
              photo={photos.empty}
              title={when === 'UPCOMING' ? t('events:empty') : t('events:emptyPast')}
              body={when === 'UPCOMING' ? t('events:emptyBody') : undefined}
              className="mt-6"
            />
          )
        }
      />
    </Screen>
  );
}
