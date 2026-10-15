import type { Timeframe } from '@movo/contracts';
import {
  EmptyState,
  IconSquare,
  ModuleHeader,
  photos,
  Screen,
  Segmented,
  Skeleton,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { EventPill } from '../../core/calendar/EventPill';
import { TimedCard } from '../../core/calendar/shared';
import { useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { PagedList } from '../../core/ui/PagedList';
import { useEvents } from './api';

export function EventsScreen() {
  const { t } = useTranslation(['events', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const canManage = useCan('event.manage');
  const [when, setWhen] = useState<Timeframe>('UPCOMING');
  const list = useEvents(societyId, when);

  return (
    <Screen scroll={false}>
      <PagedList
        list={list}
        keyExtractor={(e) => e.id}
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
        errorClassName="mt-6"
        empty={
          <EmptyState
            icon="events"
            photo={photos.empty}
            title={when === 'UPCOMING' ? t('events:empty') : t('events:emptyPast')}
            body={when === 'UPCOMING' ? t('events:emptyBody') : undefined}
            className="mt-6"
          />
        }
      />
    </Screen>
  );
}
