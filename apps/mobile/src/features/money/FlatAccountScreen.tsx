import {
  BottomBar,
  Button,
  Card,
  Coin,
  EmptyState,
  Screen,
  SectionHeader,
  Skeleton,
  TitleBar,
  theme,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatFlat, useSocietyId } from '../../core/tenant/hooks';
import { HeroPill } from '../../core/ui/DetailHero';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { SummaryHero } from '../../core/ui/SummaryHero';
import { day } from '../../core/util/date';
import { money } from '../../core/util/money';
import { useFlatAccount } from './api';
import { BillRow, PaymentRow } from './shared';

/** One flat's account, for the treasurer. */
export function FlatAccountScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const { flatId } = useRoute<RouteProp<RootStackParamList, 'FlatAccount'>>().params;
  const account = useFlatAccount(societyId, flatId);
  const a = account.data;
  const canRecord = a?.canRecordPayment === true;

  return (
    <>
      <Screen
        bottomBar={canRecord}
        refreshing={account.isRefetching}
        onRefresh={() => void account.refetch()}
      >
        <TitleBar title={a ? formatFlat(a.flat) : ''} onBack={() => nav.goBack()} />
        {loadFailed(account) ? (
          <QueryError query={account} className="mt-6" />
        ) : account.isLoading || !a ? (
          <Skeleton className="mt-6 h-40 rounded-xl" />
        ) : (
          <>
            <View className="mt-6">
              <SummaryHero
                art="sunset"
                label={t('money:totalDue', { flat: formatFlat(a.flat) })}
                value={a.outstandingPaise > 0 ? money(a.outstandingPaise) : t('money:allPaid')}
                drawing={<Coin size={56} />}
                pills={
                  <>
                    {a.nextDueDate ? (
                      <HeroPill
                        dotColor={a.overdue ? theme.color.status.danger.fg : undefined}
                        label={
                          a.overdue
                            ? t('money:overdueSince', { date: day(a.nextDueDate, 'short') })
                            : t('money:dueOn', { date: day(a.nextDueDate, 'short') })
                        }
                      />
                    ) : null}
                    {a.creditPaise > 0 ? (
                      <HeroPill
                        dot={false}
                        label={t('money:advance', { amount: money(a.creditPaise) })}
                      />
                    ) : null}
                  </>
                }
              />
            </View>
            {a.openBills.length > 0 ? (
              <>
                <SectionHeader title={t('money:status.DUE')} />
                <Card tight className="gap-2">
                  {a.openBills.map((b) => (
                    <BillRow key={b.id} bill={b} />
                  ))}
                </Card>
              </>
            ) : null}
            <SectionHeader
              title={t('money:history')}
              actionLabel={a.recentPayments.length > 0 ? t('money:allPayments') : undefined}
              onAction={() => nav.navigate('Payments', { flatId })}
            />
            {a.recentPayments.length > 0 ? (
              <Card tight className="gap-2">
                {a.recentPayments.map((p) => (
                  <PaymentRow key={p.id} payment={p} />
                ))}
              </Card>
            ) : (
              <EmptyState icon="receipt" title={t('money:noPayments')} />
            )}
          </>
        )}
      </Screen>
      {canRecord ? (
        <BottomBar
          action={
            <Button
              label={t('money:treasurer.record')}
              inline
              onPress={() => nav.navigate('RecordPayment', { flatId })}
            />
          }
        />
      ) : null}
    </>
  );
}
