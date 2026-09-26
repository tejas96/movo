import type { AssignmentStatus, DutyAssignment, DutySummary } from '@movo/contracts';
import { Button, Sheet, StatusPill, type StatusTone, Text } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { day } from '../../core/util/money';

export const TURN_TONE: Record<AssignmentStatus, StatusTone> = {
  UPCOMING: 'neutral',
  ACTIVE: 'ink',
  COMPLETED: 'success',
  MISSED: 'danger',
  SKIPPED: 'neutral',
};

export function TurnPill({ status }: { status: AssignmentStatus }) {
  const { t } = useTranslation('duties');
  return <StatusPill label={t(`status.${status}`)} tone={TURN_TONE[status]} />;
}

export function cadenceLabel(
  t: (k: string, o?: Record<string, unknown>) => string,
  d: Pick<DutySummary, 'periodUnit' | 'periodLength'>,
) {
  return t(`duties:cadence.${d.periodUnit}`, { count: d.periodLength });
}

/** "Your turn · till 31 Oct", "A-102's turn · till 31 Oct", or "Your turn · Done". */
export function turnLine(t: (k: string, o?: Record<string, unknown>) => string, a: DutyAssignment) {
  const who = a.mine ? t('duties:yourTurn') : t('duties:turnOf', { name: a.participant.label });
  if (a.status !== 'ACTIVE') return `${who} · ${t(`duties:status.${a.status}`)}`;
  return `${who} · ${t('duties:till', { date: day(a.periodEnd, 'short') })}`;
}

/** Pick several items; the order of taps is the order kept. */
export function OrderedPickSheet({
  visible,
  onClose,
  title,
  items,
  value,
  onChange,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: { id: string; label: string; hint?: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation('common');
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      footer={<Button label={t('actions.done')} onPress={onClose} />}
    >
      <View className="gap-2">
        {items.map((it) => {
          const n = value.indexOf(it.id);
          const on = n >= 0;
          return (
            <Pressable
              key={it.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(it.id)}
              className={
                on
                  ? 'flex-row items-center justify-between rounded-md bg-ink px-4 py-3.5'
                  : 'flex-row items-center justify-between rounded-md bg-card-nested px-4 py-3.5'
              }
            >
              <View className="min-w-0 flex-1">
                <Text variant="bodyMedium" tone={on ? 'inverse' : 'primary'}>
                  {it.label}
                </Text>
                {it.hint ? (
                  <Text variant="label" tone={on ? 'inverse' : 'secondary'}>
                    {it.hint}
                  </Text>
                ) : null}
              </View>
              {on ? (
                <View className="h-7 w-7 items-center justify-center rounded-full bg-white/20">
                  <Text variant="label" tone="inverse">
                    {n + 1}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
