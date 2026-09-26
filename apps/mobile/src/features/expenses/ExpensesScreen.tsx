import type { ExpenseStatus, FinanceReport } from '@movo/contracts';
import {
  BottomBar,
  Button,
  Card,
  Chip,
  DateTimeSheet,
  EmptyState,
  IconSquare,
  Input,
  OptionSheet,
  Row,
  Screen,
  SectionHeader,
  Segmented,
  SelectField,
  Sheet,
  Skeleton,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import { formatPeriod } from '@movo/i18n';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { currentLocale } from '../../core/i18n';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useCan, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { day, isoDay, money, parseRupees } from '../../core/util/money';
import { localeTag } from '../../core/util/time';
import { CATEGORY_ICON } from '../services/shared';
import { useCreateIncome, useDeleteIncome, useExpenses, useIncome, useReport } from './api';
import { ExpenseRow, expenseCategoryLabel } from './shared';

type Tab = 'list' | 'report';
const INCOME_KINDS = ['DONATION', 'INTEREST', 'HALL_BOOKING', 'PENALTY', 'OTHER'] as const;

/** Who sees what, from the member's roles and the society's sharing setting. */
function useAccess() {
  const tenant = useTenant();
  // Each hook runs every render; combine after.
  const reports = useCan('finance.reports.view');
  const create = useCan('expense.create');
  const approve = useCan('expense.approve');
  const finance = reports || create || approve;
  const shared =
    (tenant.modules.find((m) => m.key === 'expenses')?.settings.visibleToMembers as
      | string
      | undefined) ?? 'SUMMARY';
  return {
    finance,
    list: finance || shared === 'DETAILED',
    report: finance || shared !== 'NONE',
  };
}

export function ExpensesScreen() {
  const { t } = useTranslation(['expenses', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const access = useAccess();
  const canAdd = useCan('expense.create');
  const canCategories = useCan('expense.manage_categories');
  const initial = useRoute<RouteProp<RootStackParamList, 'Expenses'>>().params?.status;
  const [tab, setTab] = useState<Tab>(access.list ? 'list' : 'report');
  const [status, setStatus] = useState<ExpenseStatus | undefined>(initial);
  const list = useExpenses(societyId, status, access.list && tab === 'list');
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  if (!access.report)
    return (
      <Screen>
        <TitleBar title={t('expenses:title')} onBack={() => nav.goBack()} />
        <EmptyState icon="receipt" title={t('expenses:hidden')} className="mt-16" />
      </Screen>
    );

  return (
    <>
      <Screen
        bottomBar={canAdd}
        refreshing={list.isRefetching}
        onRefresh={() => void list.refetch()}
      >
        <TitleBar
          title={t('expenses:title')}
          onBack={() => nav.goBack()}
          trailing={
            canCategories ? (
              <IconSquare
                icon="settings"
                variant="linear"
                onPress={() => nav.navigate('ExpenseCategories')}
              />
            ) : undefined
          }
        />
        {access.list ? (
          <Segmented
            className="mt-4"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'list', label: t('expenses:tabList') },
              { value: 'report', label: t('expenses:tabReport') },
            ]}
          />
        ) : (
          <Text variant="label" tone="secondary" className="mt-3">
            {t('expenses:summaryOnly')}
          </Text>
        )}
        {tab === 'list' ? (
          <>
            {access.finance ? (
              <View className="mt-4 flex-row gap-2">
                <Chip
                  label={t('expenses:filterAll')}
                  selected={!status}
                  onPress={() => setStatus(undefined)}
                />
                <Chip
                  label={t('expenses:filterPending')}
                  selected={status === 'PENDING'}
                  onPress={() => setStatus('PENDING')}
                />
              </View>
            ) : null}
            {list.isLoading ? (
              <Skeleton className="mt-4 h-40 rounded-xl" />
            ) : items.length === 0 ? (
              <EmptyState
                icon="receipt"
                title={t('expenses:empty')}
                body={t('expenses:emptyBody')}
                className="mt-10"
              />
            ) : (
              <Card tight className="mt-4 gap-1">
                {items.map((e) => (
                  <ExpenseRow key={e.id} expense={e} />
                ))}
              </Card>
            )}
            {list.hasNextPage ? (
              <Button
                className="mt-3"
                variant="ghost"
                label={t('common:actions.seeAll')}
                loading={list.isFetchingNextPage}
                onPress={() => void list.fetchNextPage()}
              />
            ) : null}
          </>
        ) : (
          <ReportView />
        )}
      </Screen>
      {canAdd ? (
        <BottomBar
          action={
            <Button
              label={t('expenses:new')}
              icon="add"
              inline
              onPress={() => nav.navigate('ExpenseEditor')}
            />
          }
        />
      ) : null}
    </>
  );
}

function ReportView() {
  const { t } = useTranslation(['expenses', 'money']);
  const societyId = useSocietyId();
  const [fy, setFy] = useState<string | undefined>();
  const report = useReport(societyId, fy, true);
  const r = report.data;
  if (report.isLoading || !r) return <Skeleton className="mt-5 h-72 rounded-xl" />;
  return (
    <>
      {r.years.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-5 mt-4"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {r.years.map((y) => (
            <Chip
              key={y}
              label={t('expenses:report.fy', { fy: y })}
              selected={y === r.financialYear}
              onPress={() => setFy(y)}
            />
          ))}
        </ScrollView>
      ) : (
        <SectionHeader title={t('expenses:report.fy', { fy: r.financialYear })} />
      )}
      <View className={r.years.length > 1 ? 'mt-4 flex-row gap-3' : 'flex-row gap-3'}>
        <Stat label={t('expenses:report.income')} value={money(r.income.totalPaise)} />
        <Stat label={t('expenses:report.spent')} value={money(r.expenses.totalPaise)} />
      </View>
      <Card className="mt-3 flex-row items-center justify-between">
        <Text variant="bodyMedium">{t('expenses:report.net')}</Text>
        <Text variant="h2" tone={r.netPaise < 0 ? 'danger' : 'primary'}>
          {r.netPaise < 0 ? `− ${money(-r.netPaise)}` : money(r.netPaise)}
        </Text>
      </Card>
      {r.pending && r.pending.count > 0 ? (
        <Text variant="label" tone="secondary" className="mt-3">
          {t('expenses:report.pending', {
            count: r.pending.count,
            amount: money(r.pending.amountPaise),
          })}
        </Text>
      ) : null}
      {r.outstandingDuesPaise ? (
        <Text variant="label" tone="secondary" className="mt-1">
          {t('expenses:report.outstanding', { amount: money(r.outstandingDuesPaise) })}
        </Text>
      ) : null}

      <SectionHeader title={t('expenses:report.byCategory')} />
      {r.expenses.byCategory.length === 0 ? (
        <Text variant="label" tone="secondary">
          {t('expenses:report.noExpenses')}
        </Text>
      ) : (
        <Card tight className="gap-1">
          {r.expenses.byCategory.map((c) => (
            <Bar
              key={c.category.id}
              icon={CATEGORY_ICON[c.category.icon]}
              label={expenseCategoryLabel(c.category)}
              amount={c.amountPaise}
              total={r.expenses.totalPaise}
            />
          ))}
        </Card>
      )}

      <Months months={r.months} />
      <OtherIncome report={r} fy={fy} />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-lg bg-card p-4">
      <Text variant="label" tone="secondary">
        {label}
      </Text>
      <Text variant="h2" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function Bar({
  icon,
  label,
  amount,
  total,
}: {
  icon: Parameters<typeof Row>[0]['icon'];
  label: string;
  amount: number;
  total: number;
}) {
  const pct = total > 0 ? Math.max(2, Math.round((amount / total) * 100)) : 0;
  return (
    <View className="rounded-md bg-card-nested px-4 py-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          <IconSquare icon={icon ?? 'receipt'} size="sm" tone="gray" />
          <Text variant="bodyMedium" numberOfLines={1} className="flex-1">
            {label}
          </Text>
        </View>
        <Text variant="bodyMedium" className="font-semibold">
          {money(amount)}
        </Text>
      </View>
      <View className="mt-2 h-1.5 overflow-hidden rounded-full bg-card">
        <View className="h-1.5 rounded-full bg-ink" style={{ width: `${pct}%` }} />
      </View>
    </View>
  );
}

function Months({ months }: { months: FinanceReport['months'] }) {
  const { t } = useTranslation('expenses');
  const max = Math.max(1, ...months.map((m) => Math.max(m.incomePaise, m.expensePaise)));
  const shown = months.filter((m) => m.incomePaise > 0 || m.expensePaise > 0);
  if (shown.length === 0) return null;
  return (
    <>
      <SectionHeader title={t('report.byMonth')} />
      <Card className="gap-4">
        {shown.map((m) => (
          <View key={m.month} className="gap-1">
            <View className="flex-row justify-between">
              <Text variant="bodyMedium">{formatPeriod(m.month, currentLocale())}</Text>
              <Text variant="label" tone="secondary">
                {`+${money(m.incomePaise)} · −${money(m.expensePaise)}`}
              </Text>
            </View>
            <View className="h-1.5 rounded-full bg-card-nested">
              <View
                className="h-1.5 rounded-full bg-ink"
                style={{ width: `${Math.round((m.incomePaise / max) * 100)}%` }}
              />
            </View>
            <View className="h-1.5 rounded-full bg-card-nested">
              <View
                className="h-1.5 rounded-full bg-ink-tertiary"
                style={{ width: `${Math.round((m.expensePaise / max) * 100)}%` }}
              />
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}

function OtherIncome({ report, fy }: { report: FinanceReport; fy: string | undefined }) {
  const { t } = useTranslation(['expenses', 'common']);
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const canView = useCan('finance.reports.view');
  const canAdd = useCan('expense.create');
  const income = useIncome(societyId, fy, canView);
  const create = useCreateIncome(societyId);
  const remove = useDeleteIncome(societyId);
  const [open, setOpen] = useState(false);
  const [kindOpen, setKindOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [kind, setKind] = useState<(typeof INCOME_KINDS)[number]>('DONATION');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [note, setNote] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const drop = async () => {
    if (!removing) return;
    try {
      await remove.mutateAsync(removing);
      toast.show(t('expenses:income.removed'));
      setRemoving(null);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  const save = async () => {
    const amountPaise = parseRupees(amount);
    if (!amountPaise) return;
    try {
      await create.mutateAsync({
        kind,
        amountPaise,
        receivedOn: isoDay(date),
        description: note.trim() || null,
      });
      toast.show(t('expenses:income.saved'));
      setOpen(false);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  const rows = canView ? (income.data ?? []) : [];
  return (
    <>
      <SectionHeader
        title={t('expenses:report.otherIncome')}
        actionLabel={canAdd ? t('expenses:report.addIncome') : undefined}
        onAction={() => {
          setAmount('');
          setNote('');
          setDate(new Date());
          setOpen(true);
        }}
      />
      {canView && rows.length > 0 ? (
        <Card tight className="gap-1">
          {rows.map((i) => (
            <Row
              key={i.id}
              icon="moneyIn"
              title={t(`expenses:incomeKind.${i.kind}`)}
              subtitle={[day(i.receivedOn, 'short'), i.description].filter(Boolean).join(' · ')}
              trailing={
                <Text variant="bodyMedium" className="font-semibold">
                  {money(i.amountPaise)}
                </Text>
              }
              onPress={canAdd ? () => setRemoving(i.id) : undefined}
            />
          ))}
        </Card>
      ) : report.income.byKind.length > 0 ? (
        <Card tight className="gap-1">
          {report.income.byKind.map((k) => (
            <Row
              key={k.kind}
              icon="moneyIn"
              title={t(`expenses:incomeKind.${k.kind}`)}
              trailing={
                <Text variant="bodyMedium" className="font-semibold">
                  {money(k.amountPaise)}
                </Text>
              }
            />
          ))}
        </Card>
      ) : (
        <Text variant="label" tone="secondary">
          {t('expenses:report.noIncome')}
        </Text>
      )}
      <Text variant="label" tone="secondary" className="mt-3">
        {`${t('expenses:report.maintenance')}: ${money(report.income.maintenancePaise)}`}
      </Text>

      <Sheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t('expenses:income.title')}
        footer={
          <Button
            label={t('common:actions.save')}
            loading={create.isPending}
            disabled={!parseRupees(amount)}
            onPress={() => void save()}
          />
        }
      >
        <View className="gap-3">
          <SelectField
            white
            label={t('expenses:income.kind')}
            value={t(`expenses:incomeKind.${kind}`)}
            onPress={() => setKindOpen(true)}
          />
          <Input
            white
            label={t('expenses:income.amount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />
          <SelectField
            white
            label={t('expenses:income.date')}
            value={day(isoDay(date))}
            onPress={() => setDateOpen(true)}
          />
          <Input
            white
            label={t('expenses:income.description')}
            value={note}
            onChangeText={setNote}
            maxLength={300}
          />
        </View>
      </Sheet>
      <Sheet
        visible={removing !== null}
        onClose={() => setRemoving(null)}
        title={t('expenses:income.remove')}
        footer={
          <Button
            label={t('expenses:income.remove')}
            variant="danger"
            loading={remove.isPending}
            onPress={() => void drop()}
          />
        }
      >
        <Text variant="body" tone="secondary">
          {rows.find((r) => r.id === removing)
            ? `${t(`expenses:incomeKind.${rows.find((r) => r.id === removing)?.kind ?? 'OTHER'}`)} · ${money(rows.find((r) => r.id === removing)?.amountPaise ?? 0)}`
            : ''}
        </Text>
      </Sheet>
      <OptionSheet
        visible={kindOpen}
        onClose={() => setKindOpen(false)}
        title={t('expenses:income.kind')}
        value={kind}
        options={INCOME_KINDS.map((k) => ({ value: k, label: t(`expenses:incomeKind.${k}`) }))}
        onSelect={setKind}
      />
      <DateTimeSheet
        visible={dateOpen}
        onClose={() => setDateOpen(false)}
        mode="date"
        pastDays={365}
        days={1}
        value={date}
        onChange={setDate}
        localeTag={localeTag()}
        labels={{
          date: t('common:picker.date'),
          time: t('common:picker.time'),
          minutes: t('common:picker.minutes'),
          done: t('common:actions.done'),
        }}
      />
    </>
  );
}
