import {
  type AmountRule,
  type BillingFrequency,
  BillingFrequencySchema,
  type LateFeeRule,
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
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatFlat, useSocietyId } from '../../core/tenant/hooks';
import { day, isoDay, money, parseRupees, rupeesText } from '../../core/util/money';
import { localeTag } from '../../core/util/time';
import { useCollection, usePlans, useSavePlan, useSetOverride } from './api';

type LateType = LateFeeRule['type'];
const LATE_TYPES: LateType[] = ['NONE', 'FIXED', 'PERCENT', 'PER_DAY'];

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

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

  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<BillingFrequency>('MONTHLY');
  const [rule, setRule] = useState<AmountRule>('FLAT_RATE');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('10');
  const [before, setBefore] = useState('7');
  const [lateType, setLateType] = useState<LateType>('NONE');
  const [lateAmount, setLateAmount] = useState('');
  const [grace, setGrace] = useState('0');
  const [cap, setCap] = useState('');
  const [activeFrom, setActiveFrom] = useState(firstOfMonth);
  const [active, setActive] = useState(true);
  const [sheet, setSheet] = useState<'freq' | 'late' | 'date' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) return;
    setName(plan.name);
    setFrequency(plan.frequency);
    setRule(plan.amountRule);
    setAmount(rupeesText(plan.amountPaise));
    setDueDay(String(plan.dueDay));
    setBefore(String(plan.generateDaysBefore));
    setLateType(plan.lateFee.type);
    const lf = plan.lateFee;
    if (lf.type === 'FIXED' || lf.type === 'PER_DAY') setLateAmount(rupeesText(lf.amountPaise));
    if (lf.type === 'PERCENT') setLateAmount(String(lf.basisPoints / 100));
    if (lf.type !== 'NONE') setGrace(String(lf.graceDays));
    if ((lf.type === 'PERCENT' || lf.type === 'PER_DAY') && lf.capPaise)
      setCap(rupeesText(lf.capPaise));
    const [y, m, d] = plan.activeFrom.split('-').map(Number);
    setActiveFrom(new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1));
    setActive(plan.isActive);
  }, [plan]);

  const lateFee = (): LateFeeRule | null => {
    const graceDays = Number.parseInt(grace || '0', 10);
    const capPaise = cap.trim() ? parseRupees(cap) : null;
    if (lateType === 'NONE') return { type: 'NONE' };
    if (Number.isNaN(graceDays)) return null;
    if (lateType === 'PERCENT') {
      const pct = Number(lateAmount);
      if (!(pct > 0 && pct <= 100)) return null;
      return { type: 'PERCENT', basisPoints: Math.round(pct * 100), graceDays, capPaise };
    }
    const amountPaise = parseRupees(lateAmount);
    if (!amountPaise) return null;
    return lateType === 'FIXED'
      ? { type: 'FIXED', amountPaise, graceDays }
      : { type: 'PER_DAY', amountPaise, graceDays, capPaise };
  };

  const submit = async () => {
    setError(null);
    const amountPaise = parseRupees(amount);
    const due = Number.parseInt(dueDay, 10);
    const days = Number.parseInt(before, 10);
    const fee = lateFee();
    if (
      name.trim().length < 2 ||
      !amountPaise ||
      !(due >= 1 && due <= 28) ||
      !(days >= 0 && days <= 31) ||
      !fee
    ) {
      setError(t('common:validation.required'));
      return;
    }
    try {
      await save.mutateAsync({
        name: name.trim(),
        frequency,
        amountRule: rule,
        amountPaise,
        dueDay: due,
        generateDaysBefore: days,
        lateFee: fee,
        activeFrom: isoDay(activeFrom),
        isActive: active,
      });
      toast.show(t('money:plan.saved'));
      nav.goBack();
    } catch (e) {
      setError(toMessage(e));
    }
  };

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={planId ? t('money:plan.edit') : t('money:plan.new')}
          onBack={() => nav.goBack()}
        />
        <View className="mt-6 gap-3">
          <Input
            label={t('money:plan.name')}
            placeholder={t('money:plan.nameHint')}
            value={name}
            onChangeText={setName}
            maxLength={60}
          />
          <SelectField
            label={t('money:plan.frequency')}
            value={t(`money:plan.freq.${frequency}`)}
            onPress={() => setSheet('freq')}
          />
          <View>
            <Text variant="label" tone="secondary" className="mb-1.5">
              {t('money:plan.rule')}
            </Text>
            <Segmented
              value={rule}
              onChange={setRule}
              options={[
                { value: 'FLAT_RATE', label: t('money:plan.ruleOpt.FLAT_RATE') },
                { value: 'PER_SQFT', label: t('money:plan.ruleOpt.PER_SQFT') },
              ]}
            />
          </View>
          <Input
            label={rule === 'PER_SQFT' ? t('money:plan.rate') : t('money:plan.amount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={rule === 'PER_SQFT' ? '3.50' : '2500'}
          />
          <View className="flex-row gap-3">
            <Input
              containerClassName="flex-1"
              label={t('money:plan.dueDay')}
              value={dueDay}
              onChangeText={setDueDay}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Input
              containerClassName="flex-1"
              label={t('money:plan.generateBefore')}
              value={before}
              onChangeText={setBefore}
              keyboardType="number-pad"
              maxLength={2}
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
                <Input
                  containerClassName="flex-1"
                  label={
                    lateType === 'PERCENT'
                      ? t('money:plan.latePercent')
                      : lateType === 'PER_DAY'
                        ? t('money:plan.latePerDay')
                        : t('money:plan.lateAmount')
                  }
                  value={lateAmount}
                  onChangeText={setLateAmount}
                  keyboardType="decimal-pad"
                />
                <Input
                  containerClassName="flex-1"
                  label={t('money:plan.graceDays')}
                  value={grace}
                  onChangeText={setGrace}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              {lateType !== 'FIXED' ? (
                <Input
                  label={t('money:plan.cap')}
                  value={cap}
                  onChangeText={setCap}
                  keyboardType="decimal-pad"
                />
              ) : null}
            </>
          ) : null}
          <View className="flex-row items-center justify-between rounded-md bg-card px-[18px] py-3">
            <Text variant="body" className="flex-1">
              {t('money:plan.active')}
            </Text>
            <Toggle value={active} onValueChange={setActive} />
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
        onSelect={setFrequency}
      />
      <OptionSheet
        visible={sheet === 'late'}
        onClose={() => setSheet(null)}
        title={t('money:plan.lateFee')}
        value={lateType}
        options={LATE_TYPES.map((l) => ({ value: l, label: t(`money:plan.lateFeeType.${l}`) }))}
        onSelect={setLateType}
      />
      <DateTimeSheet
        visible={sheet === 'date'}
        onClose={() => setSheet(null)}
        mode="date"
        pastDays={365}
        days={365}
        title={t('money:plan.activeFrom')}
        value={activeFrom}
        onChange={setActiveFrom}
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
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const collection = useCollection(societyId, true);
  const set = useSetOverride(societyId, planId);
  const [pick, setPick] = useState(false);
  const [flatId, setFlatId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

  const run = async (id: string, amountPaise: number | null) => {
    try {
      await set.mutateAsync({ flatId: id, amountPaise });
      setFlatId(null);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };
  const flat = collection.data?.rows.find((r) => r.flat.id === flatId)?.flat;

  return (
    <>
      <SectionHeader
        title={t('money:plan.overrides')}
        actionLabel={t('money:plan.addOverride')}
        onAction={() => setPick(true)}
      />
      {overrides.length > 0 ? (
        <Card tight className="gap-1">
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
