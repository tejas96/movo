import type { BillingPlan } from '@movo/contracts';
import {
  Card,
  EmptyState,
  IconSquare,
  Row,
  Screen,
  Skeleton,
  StatusPill,
  TitleBar,
} from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { money } from '../../core/util/money';
import { usePlans } from './api';

export function planSummary(t: (k: string, o?: Record<string, unknown>) => string, p: BillingPlan) {
  const amount =
    p.amountRule === 'PER_SQFT'
      ? t('money:plan.perSqft', { amount: money(p.amountPaise) })
      : money(p.amountPaise);
  return t('money:plan.summary', {
    amount,
    freq: t(`money:plan.freq.${p.frequency}`),
    day: p.dueDay,
  });
}

export function BillingPlansScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const canEdit = useCan('maintenance.settings.manage');
  const plans = usePlans(societyId);
  const items = plans.data ?? [];
  return (
    <Screen refreshing={plans.isRefetching} onRefresh={() => void plans.refetch()}>
      <TitleBar
        title={t('money:plan.title')}
        onBack={() => nav.goBack()}
        trailing={
          canEdit ? (
            <IconSquare
              icon="add"
              variant="linear"
              tone="ink"
              onPress={() => nav.navigate('PlanEditor')}
            />
          ) : undefined
        }
      />
      {plans.isLoading ? (
        <Skeleton className="mt-6 h-24 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={t('money:plan.empty')}
          body={t('money:plan.emptyBody')}
          className="mt-10"
        />
      ) : (
        <Card tight className="mt-6 gap-1">
          {items.map((p) => (
            <Row
              key={p.id}
              icon="calendar"
              title={p.name}
              subtitle={planSummary(t as never, p)}
              trailing={
                p.isActive ? undefined : (
                  <View>
                    <StatusPill label={t('money:plan.paused')} tone="neutral" />
                  </View>
                )
              }
              onPress={canEdit ? () => nav.navigate('PlanEditor', { planId: p.id }) : undefined}
            />
          ))}
        </Card>
      )}
    </Screen>
  );
}
