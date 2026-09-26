import type { DutySummary } from '@movo/contracts';
import {
  Card,
  EmptyState,
  IconSquare,
  Screen,
  Segmented,
  Skeleton,
  StatusPill,
  Text,
  TitleBar,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { day } from '../../core/util/money';
import { useDuties } from './api';
import { cadenceLabel, turnLine } from './shared';

export function DutiesScreen() {
  const { t } = useTranslation(['duties', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const canManage = useCan('duty.manage');
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const list = useDuties(societyId, tab === 'mine');
  const items = list.data ?? [];

  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <TitleBar
        title={t('duties:title')}
        onBack={() => nav.goBack()}
        trailing={
          canManage ? (
            <IconSquare
              icon="add"
              variant="linear"
              tone="ink"
              onPress={() => nav.navigate('DutyEditor')}
            />
          ) : undefined
        }
      />
      <Segmented
        className="mt-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'mine', label: t('duties:mine') },
          { value: 'all', label: t('duties:all') },
        ]}
      />
      {list.isLoading ? (
        <Skeleton className="mt-4 h-32 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState
          icon="duties"
          title={t('duties:empty')}
          body={t('duties:emptyBody')}
          className="mt-10"
        />
      ) : (
        <View className="mt-4 gap-3">
          {items.map((d) => (
            <DutyCard key={d.id} duty={d} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function DutyCard({ duty }: { duty: DutySummary }) {
  const { t } = useTranslation(['duties', 'common']);
  const nav = useNav();
  const mineNow = duty.current?.mine && duty.current.status === 'ACTIVE';
  return (
    <Pressable onPress={() => nav.navigate('DutyDetail', { dutyId: duty.id })}>
      <Card className={mineNow ? 'bg-ink' : undefined}>
        <View className="flex-row items-center justify-between gap-3">
          <Text
            variant="h3"
            tone={mineNow ? 'inverse' : 'primary'}
            className="flex-1"
            numberOfLines={1}
          >
            {duty.title}
          </Text>
          {duty.status !== 'ACTIVE' ? (
            <StatusPill label={t(`duties:dutyStatus.${duty.status}`)} tone="neutral" />
          ) : null}
        </View>
        <Text variant="label" tone={mineNow ? 'inverse' : 'secondary'} className="mt-0.5">
          {cadenceLabel(t as never, duty)}
        </Text>
        <Text variant="bodyMedium" tone={mineNow ? 'inverse' : 'primary'} className="mt-3">
          {duty.current ? turnLine(t as never, duty.current) : t('duties:noCurrent')}
        </Text>
        {duty.next ? (
          <Text variant="label" tone={mineNow ? 'inverse' : 'secondary'}>
            {t('duties:nextTurn', {
              name: duty.next.mine ? t('duties:yourTurn') : duty.next.participant.label,
              date: day(duty.next.periodStart, 'short'),
            })}
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}
