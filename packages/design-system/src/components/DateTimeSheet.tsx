import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, View } from 'react-native';
import { Button } from './Button';
import { cn } from './cn';
import { Segmented } from './Segmented';
import { Sheet } from './Sheet';
import { Text } from './Text';

const MINUTES = ['00', '15', '30', '45'] as const;
type Minute = (typeof MINUTES)[number];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const DAY_W = 64;
const HOUR_W = 84;

export interface DateTimeSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  value: Date;
  onChange: (value: Date) => void;
  /** BCP 47 tag for day and hour labels, for example en-IN. */
  localeTag: string;
  labels: { date: string; time: string; minutes: string; done: string };
  /** How many days from today can be picked. */
  days?: number;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Date strip, hour strip and a quarter-hour switch in a sheet. Pure JS, so it needs no
 * native module. Times are in the phone's time zone.
 */
export function DateTimeSheet({
  visible,
  onClose,
  title,
  value,
  onChange,
  localeTag,
  labels,
  days = 180,
}: DateTimeSheetProps) {
  const [draft, setDraft] = useState(value);
  const dayRef = useRef<ScrollViewInstance>(null);
  const hourRef = useRef<ScrollViewInstance>(null);
  const todayKey = startOfDay(new Date()).getTime();

  const fmt = useMemo(
    () => ({
      weekday: new Intl.DateTimeFormat(localeTag, { weekday: 'short' }),
      month: new Intl.DateTimeFormat(localeTag, { month: 'short' }),
      hour: new Intl.DateTimeFormat(localeTag, { hour: 'numeric' }),
    }),
    [localeTag],
  );
  const dayList = useMemo(() => {
    const t = new Date(todayKey);
    return Array.from(
      { length: days },
      (_, i) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + i),
    );
  }, [days, todayKey]);

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    const dayIndex = Math.max(0, Math.round((startOfDay(value).getTime() - todayKey) / 86_400_000));
    // Wait for the sheet to lay out before scrolling the strips to the current value.
    const id = setTimeout(() => {
      dayRef.current?.scrollTo({ x: Math.max(0, (dayIndex - 1) * DAY_W), animated: false });
      hourRef.current?.scrollTo({
        x: Math.max(0, (value.getHours() - 1) * HOUR_W),
        animated: false,
      });
    }, 50);
    return () => clearTimeout(id);
  }, [visible, value, todayKey]);

  const set = (patch: { day?: Date; hour?: number; minute?: number }) => {
    const base = patch.day ?? draft;
    setDraft(
      new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        patch.hour ?? draft.getHours(),
        patch.minute ?? draft.getMinutes(),
      ),
    );
  };
  const minute = (MINUTES.find((m) => Number(m) === draft.getMinutes()) ?? '00') as Minute;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={
        <Button
          label={labels.done}
          onPress={() => {
            onChange(draft);
            onClose();
          }}
        />
      }
    >
      <Text variant="label" tone="secondary" className="mb-2">
        {labels.date}
      </Text>
      <ScrollView
        ref={dayRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {dayList.map((d) => {
          const on = startOfDay(draft).getTime() === d.getTime();
          return (
            <Pressable
              key={d.getTime()}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => set({ day: d })}
              style={{ width: DAY_W - 8 }}
              className={cn(
                'h-[72px] items-center justify-center rounded-md',
                on ? 'bg-ink' : 'bg-card-nested active:bg-card',
              )}
            >
              <Text variant="micro" tone={on ? 'inverse' : 'secondary'}>
                {fmt.weekday.format(d)}
              </Text>
              <Text variant="h3" tone={on ? 'inverse' : 'primary'}>
                {d.getDate()}
              </Text>
              <Text variant="micro" tone={on ? 'inverse' : 'secondary'}>
                {fmt.month.format(d)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text variant="label" tone="secondary" className="mb-2 mt-5">
        {labels.time}
      </Text>
      <ScrollView
        ref={hourRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {HOURS.map((hour) => {
          const on = draft.getHours() === hour;
          return (
            <Pressable
              key={hour}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => set({ hour })}
              style={{ width: HOUR_W - 8 }}
              className={cn(
                'h-12 items-center justify-center rounded-full',
                on ? 'bg-ink' : 'bg-card-nested active:bg-card',
              )}
            >
              <Text variant="bodyMedium" tone={on ? 'inverse' : 'primary'}>
                {fmt.hour.format(new Date(2000, 0, 1, hour))}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text variant="label" tone="secondary" className="mb-2 mt-5">
        {labels.minutes}
      </Text>
      <View>
        <Segmented
          value={minute}
          onChange={(m) => set({ minute: Number(m) })}
          options={MINUTES.map((m) => ({ value: m, label: `:${m}` }))}
        />
      </View>
    </Sheet>
  );
}
