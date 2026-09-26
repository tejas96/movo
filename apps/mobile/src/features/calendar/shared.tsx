import {
  Card,
  DateBlock,
  DateTimeSheet,
  OptionSheet,
  SelectField,
  Text,
} from '@movo/design-system';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { dateTime, dayAndMonth, localeTag, timeRange } from '../../core/util/time';

/** A meeting or event in a list: date block, title, time and place. */
export function TimedCard({
  startsAt,
  endsAt,
  title,
  location,
  pill,
  meta,
  dimmed,
  onPress,
}: {
  startsAt: string;
  endsAt: string | null;
  title: string;
  location: string | null;
  pill?: ReactNode;
  meta?: string;
  dimmed?: boolean;
  onPress: () => void;
}) {
  const { day, month } = dayAndMonth(startsAt);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card
        tight
        className={
          dimmed ? 'flex-row items-center gap-3 opacity-60' : 'flex-row items-center gap-3'
        }
      >
        <DateBlock day={day} month={month} />
        <View className="min-w-0 flex-1">
          <Text variant="bodyMedium" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="label" tone="secondary" numberOfLines={1}>
            {[timeRange(startsAt, endsAt), location].filter(Boolean).join(' · ')}
          </Text>
          {meta ? (
            <Text variant="label" tone="secondary" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {pill}
      </Card>
    </Pressable>
  );
}

export const DURATIONS = [
  { key: 'none', minutes: null },
  { key: 'm30', minutes: 30 },
  { key: 'h1', minutes: 60 },
  { key: 'h90', minutes: 90 },
  { key: 'h2', minutes: 120 },
  { key: 'h3', minutes: 180 },
  { key: 'h4', minutes: 240 },
] as const;
export type DurationKey = (typeof DURATIONS)[number]['key'];

/** Tomorrow at the given hour, on the phone's clock. */
export function defaultStart(hour: number): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, hour, 0);
}

export function durationOf(startsAt: string, endsAt: string | null): DurationKey {
  if (!endsAt) return 'none';
  const mins = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000;
  const best = DURATIONS.filter((d) => d.minutes !== null).reduce((a, b) =>
    Math.abs((b.minutes ?? 0) - mins) < Math.abs((a.minutes ?? 0) - mins) ? b : a,
  );
  return best.key;
}

export function endFor(start: Date, key: DurationKey): string | null {
  const minutes = DURATIONS.find((d) => d.key === key)?.minutes ?? null;
  return minutes === null ? null : new Date(start.getTime() + minutes * 60_000).toISOString();
}

/** Start time and length fields with their sheets. */
export function WhenFields({
  start,
  onStart,
  duration,
  onDuration,
  labels,
  error,
}: {
  start: Date;
  onStart: (d: Date) => void;
  duration: DurationKey;
  onDuration: (d: DurationKey) => void;
  labels: { startsAt: string; duration: string };
  error?: string | undefined;
}) {
  const { t } = useTranslation('common');
  const [pickOpen, setPickOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  return (
    <>
      <SelectField
        label={labels.startsAt}
        value={dateTime(start.toISOString())}
        onPress={() => setPickOpen(true)}
        error={error}
      />
      <SelectField
        label={labels.duration}
        value={t(`duration.${duration}`)}
        onPress={() => setDurationOpen(true)}
      />
      <DateTimeSheet
        visible={pickOpen}
        onClose={() => setPickOpen(false)}
        title={t('picker.pick')}
        value={start}
        onChange={onStart}
        localeTag={localeTag()}
        labels={{
          date: t('picker.date'),
          time: t('picker.time'),
          minutes: t('picker.minutes'),
          done: t('actions.done'),
        }}
      />
      <OptionSheet
        visible={durationOpen}
        onClose={() => setDurationOpen(false)}
        title={labels.duration}
        options={DURATIONS.map((d) => ({ value: d.key, label: t(`duration.${d.key}`) }))}
        value={duration}
        onSelect={onDuration}
      />
    </>
  );
}
