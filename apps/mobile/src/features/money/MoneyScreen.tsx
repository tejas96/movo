import type { FlatAccount } from '@movo/contracts';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  Icon,
  IconSquare,
  PhotoCard,
  Pill,
  photos,
  Row,
  Screen,
  SectionHeader,
  Segmented,
  Skeleton,
  Text,
  TitleBar,
  theme,
  useToast,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useCan, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { day, money } from '../../core/util/money';
import { useCollection, useGenerateBills, useMyDues } from './api';
import { BillRow, CollectionPill, PaymentRow } from './shared';

type Tab = 'mine' | 'society';

export function MoneyScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const tenant = useTenant();
  const societyId = useSocietyId();
  const viewAll = useCan('maintenance.view_all');
  const transparency =
    (tenant.modules.find((m) => m.key === 'maintenance')?.settings.transparency as
      | string
      | undefined) ?? 'STATUS';
  const showSociety = viewAll || transparency !== 'OFF';
  const hasFlat = tenant.flats.length > 0;
  const [tab, setTab] = useState<Tab>(hasFlat || !showSociety ? 'mine' : 'society');
  const dues = useMyDues(societyId, hasFlat);
  const collection = useCollection(societyId, showSociety && tab === 'society');
  const refreshing = tab === 'mine' ? dues.isRefetching : collection.isRefetching;

  return (
    <Screen
      tabBar
      refreshing={refreshing}
      onRefresh={() => void (tab === 'mine' ? dues.refetch() : collection.refetch())}
    >
      <TitleBar
        large
        title={t('money:title')}
        trailing={
          hasFlat ? (
            <IconSquare icon="receipt" variant="linear" onPress={() => nav.navigate('Payments')} />
          ) : undefined
        }
      />
      {showSociety ? (
        <Segmented
          className="mt-4"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'mine', label: t('money:myDues') },
            { value: 'society', label: t('money:society') },
          ]}
        />
      ) : null}

      {tab === 'mine' ? (
        !hasFlat ? (
          <EmptyState
            photo={photos.empty}
            icon="wallet"
            title={t('money:noDues')}
            body={t('money:noFlat')}
            className="mt-16"
          />
        ) : dues.isLoading ? (
          <Skeleton className="mt-5 h-56 rounded-xl" />
        ) : (
          dues.data?.flats.map((a) => <FlatDues key={a.flat.id} account={a} />)
        )
      ) : (
        <SocietyCollection loading={collection.isLoading} data={collection.data} />
      )}

      <TreasurerTools />
    </Screen>
  );
}

function FlatDues({ account }: { account: FlatAccount }) {
  const { t } = useTranslation('money');
  const nav = useNav();
  const flat = formatFlat(account.flat);
  const paidUp = account.outstandingPaise === 0;
  return (
    <>
      <PhotoCard
        className="mt-5"
        source={photos.money}
        photoHeight={130}
        badge={{ icon: 'flat', label: flat }}
      >
        <Text variant="label" tone="secondary">
          {t('totalDue', { flat })}
        </Text>
        <Text variant="display">{paidUp ? t('allPaid') : money(account.outstandingPaise)}</Text>
        <View className="mt-2.5 flex-row flex-wrap gap-2">
          {account.nextDueDate ? (
            <Pill
              icon="calendar"
              label={
                account.overdue
                  ? t('overdueSince', { date: day(account.nextDueDate, 'short') })
                  : t('dueOn', { date: day(account.nextDueDate, 'short') })
              }
            />
          ) : null}
          {account.openBills.length > 0 ? (
            <Pill icon="receipt" label={t('billCount', { count: account.openBills.length })} />
          ) : null}
          {account.creditPaise > 0 ? (
            <Pill icon="wallet" label={t('advance', { amount: money(account.creditPaise) })} />
          ) : null}
        </View>
        {account.openBills.length > 0 ? (
          <>
            <Divider />
            <View className="gap-1">
              {account.openBills.map((b) => (
                <BillRow key={b.id} bill={b} onGray />
              ))}
            </View>
          </>
        ) : null}
        {!paidUp ? (
          <Button
            className="mt-4"
            icon="upi"
            label={t('howToPay')}
            onPress={() =>
              nav.navigate('HowToPay', { amountPaise: account.outstandingPaise, note: flat })
            }
          />
        ) : null}
      </PhotoCard>
      {account.recentPayments.length > 0 ? (
        <>
          <SectionHeader
            title={t('history')}
            actionLabel={t('allPayments')}
            onAction={() => nav.navigate('Payments', { flatId: account.flat.id })}
          />
          <Card tight className="gap-2">
            {account.recentPayments.slice(0, 3).map((p) => (
              <PaymentRow key={p.id} payment={p} />
            ))}
          </Card>
        </>
      ) : null}
    </>
  );
}

function SocietyCollection({
  loading,
  data,
}: {
  loading: boolean;
  data: ReturnType<typeof useCollection>['data'];
}) {
  const { t } = useTranslation('money');
  const nav = useNav();
  const viewAll = useCan('maintenance.view_all');
  if (loading || !data) return <Skeleton className="mt-5 h-56 rounded-xl" />;
  const pending = data.counts.due + data.counts.overdue;
  return (
    <>
      <SectionHeader title={t('collection.fy', { fy: data.financialYear })} />
      <View className="flex-row gap-3">
        <Stat
          icon="check"
          value={String(data.counts.paid)}
          hint={t('collection.paidOf', { total: data.counts.flats })}
        />
        <Stat icon="clock" value={String(pending)} hint={t('collection.pending')} />
        {data.collectedPaise !== null ? (
          <Stat icon="wallet" value={money(data.collectedPaise)} hint={t('collection.collected')} />
        ) : null}
      </View>
      {data.outstandingPaise !== null ? (
        <Text variant="label" tone="secondary" className="mt-3">
          {`${t('collection.billed')} ${money(data.billedPaise ?? 0)} · ${t('collection.outstanding')} ${money(data.outstandingPaise)}`}
        </Text>
      ) : null}
      <Card tight className="mt-4 gap-2">
        {data.rows.map((r) => (
          <Row
            key={r.flat.id}
            icon="flat"
            title={formatFlat(r.flat)}
            subtitle={
              r.lastPaidOn
                ? t('collection.lastPaid', { date: day(r.lastPaidOn, 'short') })
                : undefined
            }
            trailing={
              <View className="items-end gap-1">
                {r.outstandingPaise ? (
                  <Text variant="bodyMedium" className="font-semibold">
                    {money(r.outstandingPaise)}
                  </Text>
                ) : null}
                <CollectionPill status={r.status} />
              </View>
            }
            onPress={viewAll ? () => nav.navigate('FlatAccount', { flatId: r.flat.id }) : undefined}
          />
        ))}
      </Card>
    </>
  );
}

function Stat({
  icon,
  value,
  hint,
}: {
  icon: 'check' | 'clock' | 'wallet';
  value: string;
  hint: string;
}) {
  return (
    <View className="flex-1 gap-3 rounded-lg bg-card p-4">
      <Icon name={icon} variant="bold" size={24} color={theme.color.icon.primary} />
      <View>
        <Text variant="h3" numberOfLines={1}>
          {value}
        </Text>
        <Text variant="label" tone="secondary" numberOfLines={1}>
          {hint}
        </Text>
      </View>
    </View>
  );
}

function TreasurerTools() {
  const { t } = useTranslation(['money', 'expenses']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const canRecord = useCan('maintenance.record_payment');
  const canGenerate = useCan('maintenance.generate_bills');
  const canSettings = useCan('maintenance.settings.manage');
  const canPlans = useCan('maintenance.view_all') && (canSettings || canGenerate);
  const canExpenses = useCan('expense.create');
  const generate = useGenerateBills(societyId);
  if (!canRecord && !canGenerate && !canSettings && !canExpenses) return null;

  const runGenerate = async () => {
    try {
      const r = await generate.mutateAsync();
      toast.show(
        r.created > 0
          ? t('treasurer.generated', { count: r.created })
          : t('treasurer.generatedNone'),
      );
      if (r.skippedFlats.length > 0)
        toast.show(t('treasurer.skipped', { count: r.skippedFlats.length }), 'error');
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <>
      <SectionHeader title={t('treasurer.title')} />
      <Card tight className="gap-2">
        {canRecord ? (
          <Row
            icon="moneyIn"
            title={t('treasurer.record')}
            onPress={() => nav.navigate('RecordPayment')}
          />
        ) : null}
        {canGenerate ? (
          <Pressable disabled={generate.isPending}>
            <Row
              icon="receipt"
              title={t('treasurer.generate')}
              onPress={() => void runGenerate()}
            />
          </Pressable>
        ) : null}
        {canGenerate ? (
          <Row
            icon="addCircle"
            title={t('treasurer.adhoc')}
            onPress={() => nav.navigate('AdhocBill')}
          />
        ) : null}
        {canExpenses ? (
          <Row
            icon="moneyOut"
            title={t('expenses:title')}
            onPress={() => nav.navigate('Expenses')}
          />
        ) : null}
        {canPlans ? (
          <Row
            icon="calendar"
            title={t('treasurer.plans')}
            onPress={() => nav.navigate('BillingPlans')}
          />
        ) : null}
        {canSettings ? (
          <Row
            icon="bank"
            title={t('treasurer.instructions')}
            onPress={() => nav.navigate('PaymentInstructions')}
          />
        ) : null}
      </Card>
    </>
  );
}
