import type { FlatAccount } from '@movo/contracts';
import {
  ArtCard,
  Button,
  Coin,
  EmptyState,
  Glass,
  IconSquare,
  Rise,
  Row,
  Screen,
  SectionLabel,
  Segmented,
  Skeleton,
  Text,
  theme,
  useCountUp,
  useToast,
} from '@movo/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useCan, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { SummaryHero } from '../../core/ui/SummaryHero';
import { day, shortMonth } from '../../core/util/date';
import { money } from '../../core/util/money';
import { useCollection, useGenerateBills, useMyDues } from './api';
import { paidLastSixMonths } from './paid-months';
import { BillRow, CollectionPill, PaymentRow } from './shared';

type Tab = 'mine' | 'society';

/** Soft Glow Money, laid out like docs/design/soft-glow/source/Money.dc.html. */
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
      glow="warm"
      refreshing={refreshing}
      onRefresh={() => void (tab === 'mine' ? dues.refetch() : collection.refetch())}
    >
      <View style={styles.stack}>
        <Rise>
          <View style={styles.head}>
            <Text variant="h1" className="flex-1" numberOfLines={1}>
              {t('money:title')}
            </Text>
            {hasFlat && !showSociety ? (
              <IconSquare
                icon="receipt"
                variant="linear"
                onPress={() => nav.navigate('Payments')}
                accessibilityLabel={t('money:allPayments')}
              />
            ) : null}
          </View>
          {showSociety ? (
            <Segmented
              className="mt-4"
              options={[
                { value: 'mine', label: t('money:myDues') },
                { value: 'society', label: t('money:society') },
              ]}
              value={tab}
              onChange={setTab}
            />
          ) : null}
        </Rise>

        {tab === 'mine' ? (
          !hasFlat ? (
            <EmptyState icon="wallet" title={t('money:noDues')} body={t('money:noFlat')} />
          ) : dues.isLoading ? (
            <Skeleton className="h-64 rounded-rim" />
          ) : loadFailed(dues) ? (
            <QueryError query={dues} />
          ) : (
            dues.data?.flats.map((a) => <FlatDues key={a.flat.id} account={a} />)
          )
        ) : loadFailed(collection) ? (
          <QueryError query={collection} />
        ) : (
          <SocietyCollection loading={collection.isLoading} data={collection.data} />
        )}

        <TreasurerTools />
      </View>
    </Screen>
  );
}

/** One flat: the sunset art card with the amount, open bills, and what you paid. */
function FlatDues({ account }: { account: FlatAccount }) {
  const { t } = useTranslation('money');
  const nav = useNav();
  const flat = formatFlat(account.flat);
  const paidUp = account.outstandingPaise === 0;
  const rupees = useCountUp(Math.round(account.outstandingPaise / 100), {
    delay: 400,
    duration: 1200,
  });
  const months = paidLastSixMonths(account.recentPayments);
  const anyPaid = months.some((m) => m.paise > 0);
  return (
    <>
      <Rise delay={80}>
        <ArtCard art="sunset" contentStyle={styles.heroContent}>
          <View style={styles.coinBig} pointerEvents="none">
            <Coin size={70} />
          </View>
          <View style={styles.coinSmall} pointerEvents="none">
            <Coin size={38} tone="pale" delay={400} />
          </View>
          <Text variant="caption" tone="soft">
            {t('totalDue', { flat })}
          </Text>
          <Text variant="display" style={styles.amount}>
            {paidUp ? t('allPaid') : money(rupees * 100)}
          </Text>
          <View style={styles.pills}>
            {account.nextDueDate ? (
              <Tag
                dot={account.overdue ? theme.color.status.danger.fg : theme.color.accent.fg}
                label={
                  account.overdue
                    ? t('overdueSince', { date: day(account.nextDueDate, 'short') })
                    : t('dueOn', { date: day(account.nextDueDate, 'short') })
                }
              />
            ) : null}
            {account.openBills.length > 0 ? (
              <Tag label={t('billCount', { count: account.openBills.length })} />
            ) : null}
            {account.creditPaise > 0 ? (
              <Tag label={t('advance', { amount: money(account.creditPaise) })} />
            ) : null}
          </View>
          {!paidUp ? (
            <Button
              arrow
              className="mt-4"
              label={t('glow.pay', { amount: money(account.outstandingPaise) })}
              onPress={() =>
                nav.navigate('HowToPay', { amountPaise: account.outstandingPaise, note: flat })
              }
            />
          ) : null}
        </ArtCard>
      </Rise>

      {account.openBills.length > 0 ? (
        <Rise delay={160}>
          <Glass radius={28} style={styles.list}>
            <SectionLabel>{t('glow.openBills')}</SectionLabel>
            {account.openBills.map((b) => (
              <BillRow key={b.id} bill={b} onGray />
            ))}
          </Glass>
        </Rise>
      ) : null}

      {anyPaid ? (
        <Rise delay={240}>
          <Glass radius={28} style={styles.chart}>
            <View style={styles.chartHead}>
              <Text variant="h3">{t('glow.paid')}</Text>
              <Text variant="label" tone="secondary">
                {t('glow.months')}
              </Text>
            </View>
            <View style={styles.bars}>
              {months.map((m, i) => (
                <Bar
                  key={`${m.year}-${m.month}`}
                  share={m.paise / Math.max(...months.map((x) => x.paise), 1)}
                  label={shortMonth(m.month)}
                  current={m.current}
                  delay={400 + i * 80}
                />
              ))}
            </View>
          </Glass>
        </Rise>
      ) : null}

      {account.recentPayments.length > 0 ? (
        <Rise delay={320}>
          <Glass radius={28} style={styles.list}>
            <View style={styles.listHead}>
              <SectionLabel>{t('history')}</SectionLabel>
              <Pressable
                onPress={() => nav.navigate('Payments', { flatId: account.flat.id })}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text variant="label" tone="accent" className="font-medium">
                  {t('allPayments')}
                </Text>
              </Pressable>
            </View>
            {account.recentPayments.slice(0, 3).map((p) => (
              <PaymentRow key={p.id} payment={p} onGray />
            ))}
          </Glass>
        </Rise>
      ) : null}
    </>
  );
}

/** A white pill on art cards, with an optional coloured dot. */
function Tag({ label, dot }: { label: string; dot?: string }) {
  return (
    <View style={styles.tag}>
      {dot ? <View style={[styles.tagDot, { backgroundColor: dot }]} /> : null}
      <Text variant="label" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** One month's bar: pink to peach, orange for this month; grows up on open. */
function Bar({
  share,
  label,
  current,
  delay,
}: {
  share: number;
  label: string;
  current: boolean;
  delay: number;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    p.value = withDelay(
      delay,
      withTiming(1, { duration: 900, easing: Easing.bezier(0.2, 1.1, 0.4, 1) }),
    );
  }, [reduced, delay, p]);
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleY: p.value }] }));
  const height = Math.max(10, Math.round(100 * share));
  return (
    <View style={styles.barCol}>
      <Animated.View
        style={[
          styles.bar,
          {
            height,
            // Orange for this month, pink for paid months, a faint stub for months with nothing.
            backgroundColor:
              share === 0 ? 'rgba(43, 42, 46, 0.08)' : current ? theme.color.accent.fg : '#F5B5C8',
          },
          grow,
        ]}
      />
      <Text
        variant="micro"
        tone={current ? 'primary' : 'secondary'}
        className={current ? 'font-semibold' : 'font-normal'}
      >
        {label}
      </Text>
    </View>
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
  if (loading || !data) return <Skeleton className="h-56 rounded-[30px]" />;
  const share = data.counts.flats > 0 ? data.counts.paid / data.counts.flats : 0;
  return (
    <>
      <Rise>
        <SummaryHero
          art="meadow"
          label={t('collection.fy', { fy: data.financialYear })}
          value={
            data.collectedPaise !== null
              ? money(data.collectedPaise)
              : t('glow.flatsPaid', { paid: data.counts.paid, total: data.counts.flats })
          }
          icon={{ name: 'wallet', motion: 'bob' }}
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
          </View>
          <View style={styles.trackLabels}>
            <Text variant="caption" tone="soft">
              {t('glow.flatsPaid', { paid: data.counts.paid, total: data.counts.flats })}
            </Text>
            <Text variant="caption" className="font-semibold">
              {`${Math.round(share * 100)}%`}
            </Text>
          </View>
          {/* Society totals for whoever may see amounts (the server sends null otherwise). */}
          {data.outstandingPaise !== null ? (
            <Text variant="label" tone="soft" className="mt-2">
              {`${t('collection.billed')} ${money(data.billedPaise ?? 0)} · ${t('collection.outstanding')} ${money(data.outstandingPaise)}`}
            </Text>
          ) : null}
        </SummaryHero>
      </Rise>
      <Rise delay={80}>
        <View style={styles.stats}>
          <Glass radius={24} style={styles.stat}>
            <Tag dot={theme.color.accent.fg} label={t('glow.due')} />
            <Text variant="h2">{t('glow.flatsCount', { count: data.counts.due })}</Text>
          </Glass>
          <Glass radius={24} style={styles.stat}>
            <Tag dot={theme.color.status.danger.fg} label={t('status.OVERDUE')} />
            <Text variant="h2">{t('glow.flatsCount', { count: data.counts.overdue })}</Text>
          </Glass>
        </View>
      </Rise>
      <Rise delay={160}>
        <Glass radius={28} style={styles.list}>
          <SectionLabel>{t('glow.flats')}</SectionLabel>
          {data.rows.map((r) => (
            <Row
              key={r.flat.id}
              onGray
              icon="flat"
              title={formatFlat(r.flat)}
              subtitle={
                r.lastPaidOn
                  ? t('collection.lastPaid', { date: day(r.lastPaidOn, 'short') })
                  : undefined
              }
              trailing={
                <View style={styles.rowEnd}>
                  {r.outstandingPaise ? (
                    <Text variant="title">{money(r.outstandingPaise)}</Text>
                  ) : null}
                  <CollectionPill status={r.status} />
                </View>
              }
              onPress={
                viewAll ? () => nav.navigate('FlatAccount', { flatId: r.flat.id }) : undefined
              }
            />
          ))}
        </Glass>
      </Rise>
    </>
  );
}

function TreasurerTools() {
  const { t } = useTranslation(['money', 'expenses']);
  const nav = useNav();
  const toast = useToast();
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const canRecord = useCan('maintenance.record_payment');
  const canGenerate = useCan('maintenance.generate_bills');
  const canSettings = useCan('maintenance.settings.manage');
  const canPlans = useCan('maintenance.view_all') && (canSettings || canGenerate);
  const canExpenses = useCan('expense.create');
  const generate = useGenerateBills(societyId);
  if (!canRecord && !canGenerate && !canSettings && !canExpenses) return null;

  const runGenerate = async () => {
    await withErrorToast(async () => {
      const r = await generate.mutateAsync();
      toast.show(
        r.created > 0
          ? t('treasurer.generated', { count: r.created })
          : t('treasurer.generatedNone'),
      );
      if (r.skippedFlats.length > 0)
        toast.show(t('treasurer.skipped', { count: r.skippedFlats.length }), 'error');
    });
  };

  return (
    <Rise delay={400}>
      <Glass radius={28} style={styles.list}>
        <SectionLabel>{t('treasurer.title')}</SectionLabel>
        {canRecord ? (
          <Row
            onGray
            icon="moneyIn"
            title={t('treasurer.record')}
            onPress={() => nav.navigate('RecordPayment')}
          />
        ) : null}
        {canGenerate ? (
          <Pressable disabled={generate.isPending}>
            <Row
              onGray
              icon="receipt"
              title={t('treasurer.generate')}
              onPress={() => void runGenerate()}
            />
          </Pressable>
        ) : null}
        {canGenerate ? (
          <Row
            onGray
            icon="addCircle"
            title={t('treasurer.adhoc')}
            onPress={() => nav.navigate('AdhocBill')}
          />
        ) : null}
        {canExpenses ? (
          <Row
            onGray
            icon="moneyOut"
            title={t('expenses:title')}
            onPress={() => nav.navigate('Expenses')}
          />
        ) : null}
        {canPlans ? (
          <Row
            onGray
            icon="calendar"
            title={t('treasurer.plans')}
            onPress={() => nav.navigate('BillingPlans')}
          />
        ) : null}
        {canSettings ? (
          <Row
            onGray
            icon="bank"
            title={t('treasurer.instructions')}
            onPress={() => nav.navigate('PaymentInstructions')}
          />
        ) : null}
      </Glass>
    </Rise>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroContent: { padding: 20 },
  coinBig: { position: 'absolute', top: 18, right: 26 },
  coinSmall: { position: 'absolute', top: 70, right: 90 },
  amount: { marginTop: 60 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  tagDot: { width: 7, height: 7, borderRadius: 4 },
  list: { padding: 8 },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 12,
  },
  chart: { padding: 18 },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, height: 130, marginTop: 16 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: '100%' },
  bar: { width: '100%', borderRadius: 999, transformOrigin: 'bottom' },
  track: {
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    marginTop: 16,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 999, backgroundColor: theme.color.accent.fg },
  trackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, padding: 16, gap: 6 },
  rowEnd: { alignItems: 'flex-end', gap: 4 },
});
