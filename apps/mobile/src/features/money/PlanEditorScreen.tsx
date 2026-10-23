import {
  type AmountRule,
  type BillingFrequency,
  BillingFrequencySchema,
  type BillingPlan,
  type LateFeeRule,
  maintenanceContract,
} from '@movo/contracts';
import {
  BottomBar,
  Button,
  Card,
  DateTimeSheet,
  Input,
  OptionSheet,
  Row,
  Screen,
  SectionHeader,
  Segmented,
  SelectField,
  Sheet,
  Text,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { bodyResolver, formMessage, usePrefill } from '../../core/forms/contract-form';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatFlat, useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { day, fromIsoDay, isoDay, localeTag } from '../../core/util/date';
import { money, parseRupees, rupeesText } from '../../core/util/money';
import { useCollection, usePlans, useSavePlan, useSetOverride } from './api';

type LateType = LateFeeRule['type'];
const LATE_TYPES: LateType[] = ['NONE', 'FIXED', 'PERCENT', 'PER_DAY'];

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

interface PlanForm {
  name: string;
  frequency: BillingFrequency;
  rule: AmountRule;
  amount: string;
  dueDay: string;
  before: string;
  lateType: LateType;
  lateAmount: string;
  grace: string;
  cap: string;
  activeFrom: Date;
  active: boolean;
}

const emptyForm = (): PlanForm => ({
  name: '',
  frequency: 'MONTHLY',
  rule: 'FLAT_RATE',
  amount: '',
  dueDay: '10',
  before: '7',
  lateType: 'NONE',
  lateAmount: '',
  grace: '0',
  cap: '',
  activeFrom: firstOfMonth(),
  active: true,
});

function toForm(plan: BillingPlan): PlanForm {
  const lf = plan.lateFee;
  return {
    name: plan.name,
    frequency: plan.frequency,
    rule: plan.amountRule,
    amount: rupeesText(plan.amountPaise),
    dueDay: String(plan.dueDay),
    before: String(plan.generateDaysBefore),
    lateType: lf.type,
    lateAmount:
      lf.type === 'FIXED' || lf.type === 'PER_DAY'
        ? rupeesText(lf.amountPaise)
        : lf.type === 'PERCENT'
          ? String(lf.basisPoints / 100)
          : '',
    grace: lf.type !== 'NONE' ? String(lf.graceDays) : '0',
    cap:
      (lf.type === 'PERCENT' || lf.type === 'PER_DAY') && lf.capPaise
        ? rupeesText(lf.capPaise)
        : '',
    activeFrom: fromIsoDay(plan.activeFrom),
    active: plan.isActive,
  };
}

/**
 * The late fee as sent. A bad number stays in (NaN, 0) so the body schema rejects it, as the
 * old check did; a percent outside 0 to 100 becomes 0 basis points for the same reason.
 */
function lateFee(v: PlanForm): LateFeeRule {
  const graceDays = Number.parseInt(v.grace || '0', 10);
  const capPaise = v.cap.trim() ? parseRupees(v.cap) : null;
  if (v.lateType === 'NONE') return { type: 'NONE' };
  if (v.lateType === 'PERCENT') {
    const pct = Number(v.lateAmount);
    const basisPoints = pct > 0 && pct <= 100 ? Math.round(pct * 100) : 0;
    return { type: 'PERCENT', basisPoints, graceDays, capPaise };
  }
  const amountPaise = parseRupees(v.lateAmount) ?? 0;
  return v.lateType === 'FIXED'
    ? { type: 'FIXED', amountPaise, graceDays }
    : { type: 'PER_DAY', amountPaise, graceDays, capPaise };
}

function toBody(v: PlanForm) {
  return {
    name: v.name.trim(),
    frequency: v.frequency,
    amountRule: v.rule,
    amountPaise: parseRupees(v.amount) ?? 0,
    dueDay: Number.parseInt(v.dueDay, 10),
    generateDaysBefore: Number.parseInt(v.before, 10),
    lateFee: lateFee(v),
    activeFrom: isoDay(v.activeFrom),
    isActive: v.active,
  };
}

export function PlanEditorScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const planId = useRoute<RouteProp<RootStackParamList, 'PlanEditor'>>().params?.planId;
  const plans = usePlans(societyId);
  const plan = plans.data?.find((p) => p.id === planId);
  const save = useSavePlan(societyId, planId);

  const [sheet, setSheet] = useState<'freq' | 'late' | 'date' | null>(null);
  const [empty] = useState(emptyForm);
  // Same body for create and edit (the edit route takes it as a partial).
  const form = useForm<PlanForm>({
    resolver: bodyResolver(maintenanceContract.createPlan.body, toBody),
    defaultValues: empty,
    reValidateMode: 'onSubmit',
  });
  usePrefill(form, planId ? plan : undefined, toForm);
  const error = formMessage(form, t('common:validation.required'));
  const { frequency, rule, lateType, activeFrom, active } = form.watch();

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(toBody(values));
      toast.show(t('money:plan.saved'));
      nav.goBack();
    } catch (e) {
      form.setError('root.server', { message: toMessage(e) });
    }
  });

  if (planId && loadFailed(plans))
    return (
      <Screen>
        <TitleBar title={t('money:plan.edit')} onBack={() => nav.goBack()} />
        <QueryError query={plans} className="mt-10" />
      </Screen>
    );

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={planId ? t('money:plan.edit') : t('money:plan.new')}
          onBack={() => nav.goBack()}
        />
        <View className="mt-6 gap-3">
          <Controller
            control={form.control}
            name="name"
            render={({ field }) => (
              <Input
                label={t('money:plan.name')}
                placeholder={t('money:plan.nameHint')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={60}
              />
            )}
          />
          <SelectField
            label={t('money:plan.frequency')}
            value={t(`money:plan.freq.${frequency}`)}
            onPress={() => setSheet('freq')}
          />
          <View>
            <Text variant="caption" className="mb-1.5 pl-1.5 font-medium">
              {t('money:plan.rule')}
            </Text>
            <Segmented
              value={rule}
              onChange={(r) => form.setValue('rule', r)}
              options={[
                { value: 'FLAT_RATE', label: t('money:plan.ruleOpt.FLAT_RATE') },
                { value: 'PER_SQFT', label: t('money:plan.ruleOpt.PER_SQFT') },
              ]}
            />
          </View>
          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <Input
                label={rule === 'PER_SQFT' ? t('money:plan.rate') : t('money:plan.amount')}
                value={field.value}
                onChangeText={field.onChange}
                keyboardType="decimal-pad"
                placeholder={rule === 'PER_SQFT' ? '3.50' : '2500'}
              />
            )}
          />
          <View className="flex-row gap-3">
            <Controller
              control={form.control}
              name="dueDay"
              render={({ field }) => (
                <Input
                  containerClassName="flex-1"
                  label={t('money:plan.dueDay')}
                  value={field.value}
                  onChangeText={field.onChange}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              )}
            />
            <Controller
              control={form.control}
              name="before"
              render={({ field }) => (
                <Input
                  containerClassName="flex-1"
                  label={t('money:plan.generateBefore')}
                  value={field.value}
                  onChangeText={field.onChange}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              )}
            />
          </View>
          <SelectField
            label={t('money:plan.activeFrom')}
            value={day(isoDay(activeFrom))}
            onPress={() => setSheet('date')}
          />
          <SelectField
            label={t('money:plan.lateFee')}
            value={t(`money:plan.lateFeeType.${lateType}`)}
            onPress={() => setSheet('late')}
          />
          {lateType !== 'NONE' ? (
            <>
              <View className="flex-row gap-3">
                <Controller
                  control={form.control}
                  name="lateAmount"
                  render={({ field }) => (
                    <Input
                      containerClassName="flex-1"
                      label={
                        lateType === 'PERCENT'
                          ? t('money:plan.latePercent')
                          : lateType === 'PER_DAY'
                            ? t('money:plan.latePerDay')
                            : t('money:plan.lateAmount')
                      }
                      value={field.value}
                      onChangeText={field.onChange}
                      keyboardType="decimal-pad"
                    />
                  )}
                />
                <Controller
                  control={form.control}
                  name="grace"
                  render={({ field }) => (
                    <Input
                      containerClassName="flex-1"
                      label={t('money:plan.graceDays')}
                      value={field.value}
                      onChangeText={field.onChange}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  )}
                />
              </View>
              {lateType !== 'FIXED' ? (
                <Controller
                  control={form.control}
                  name="cap"
                  render={({ field }) => (
                    <Input
                      label={t('money:plan.cap')}
                      value={field.value}
                      onChangeText={field.onChange}
                      keyboardType="decimal-pad"
                    />
                  )}
                />
              ) : null}
            </>
          ) : null}
          <View className="flex-row items-center justify-between rounded-[22px] bg-card-nested px-[18px] py-3">
            <Text variant="body" className="flex-1">
              {t('money:plan.active')}
            </Text>
            <Toggle value={active} onValueChange={(on) => form.setValue('active', on)} />
          </View>
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </View>
        {plan ? <Overrides planId={plan.id} overrides={plan.overrides} /> : null}
      </Screen>
      <BottomBar
        action={
          <Button
            label={t('common:actions.save')}
            inline
            loading={save.isPending}
            onPress={() => void submit()}
          />
        }
      />
      <OptionSheet
        visible={sheet === 'freq'}
        onClose={() => setSheet(null)}
        title={t('money:plan.frequency')}
        value={frequency}
        options={BillingFrequencySchema.options.map((f) => ({
          value: f,
          label: t(`money:plan.freq.${f}`),
        }))}
        onSelect={(f) => form.setValue('frequency', f)}
      />
      <OptionSheet
        visible={sheet === 'late'}
        onClose={() => setSheet(null)}
        title={t('money:plan.lateFee')}
        value={lateType}
        options={LATE_TYPES.map((l) => ({ value: l, label: t(`money:plan.lateFeeType.${l}`) }))}
        onSelect={(l) => form.setValue('lateType', l)}
      />
      <DateTimeSheet
        visible={sheet === 'date'}
        onClose={() => setSheet(null)}
        mode="date"
        pastDays={365}
        days={365}
        title={t('money:plan.activeFrom')}
        value={activeFrom}
        onChange={(d) => form.setValue('activeFrom', d)}
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

function Overrides({
  planId,
  overrides,
}: {
  planId: string;
  overrides: {
    flat: { id: string; number: string; buildingName: string | null };
    amountPaise: number;
  }[];
}) {
  const { t } = useTranslation(['money', 'common']);
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const collection = useCollection(societyId, true);
  const set = useSetOverride(societyId, planId);
  const [pick, setPick] = useState(false);
  const [flatId, setFlatId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

  const run = (id: string, amountPaise: number | null) =>
    withErrorToast(async () => {
      await set.mutateAsync({ flatId: id, amountPaise });
      setFlatId(null);
    });
  const flat = collection.data?.rows.find((r) => r.flat.id === flatId)?.flat;

  return (
    <>
      <SectionHeader
        title={t('money:plan.overrides')}
        actionLabel={t('money:plan.addOverride')}
        onAction={() => setPick(true)}
      />
      {overrides.length > 0 ? (
        <Card tight className="gap-2">
          {overrides.map((o) => (
            <Row
              key={o.flat.id}
              icon="flat"
              title={formatFlat(o.flat)}
              subtitle={money(o.amountPaise)}
              trailing={
                <Button
                  label={t('money:plan.remove')}
                  variant="ghost"
                  size="sm"
                  inline
                  onPress={() => void run(o.flat.id, null)}
                />
              }
            />
          ))}
        </Card>
      ) : null}
      <OptionSheet
        visible={pick}
        onClose={() => setPick(false)}
        title={t('money:record.pickFlat')}
        options={(collection.data?.rows ?? []).map((r) => ({
          value: r.flat.id,
          label: formatFlat(r.flat),
        }))}
        onSelect={(id) => {
          setAmount('');
          setFlatId(id);
        }}
      />
      <Sheet
        visible={flatId !== null}
        onClose={() => setFlatId(null)}
        title={flat ? formatFlat(flat) : undefined}
        footer={
          <Button
            label={t('common:actions.save')}
            loading={set.isPending}
            disabled={!parseRupees(amount)}
            onPress={() => flatId && void run(flatId, parseRupees(amount))}
          />
        }
      >
        <Input
          label={t('money:plan.overrideAmount')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          white
        />
      </Sheet>
    </>
  );
}
