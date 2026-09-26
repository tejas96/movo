import { type PaymentMethod, PaymentMethodSchema } from '@movo/contracts';
import {
  BottomBar,
  Button,
  Chip,
  DateTimeSheet,
  Input,
  OptionSheet,
  Screen,
  SelectField,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatFlat, useSocietyId } from '../../core/tenant/hooks';
import {
  day,
  isoDay,
  money,
  newIdempotencyKey,
  parseRupees,
  rupeesText,
} from '../../core/util/money';
import { localeTag } from '../../core/util/time';
import { useCollection, useFlatAccount, useRecordPayment } from './api';

export function RecordPaymentScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const initialFlat = useRoute<RouteProp<RootStackParamList, 'RecordPayment'>>().params?.flatId;
  const collection = useCollection(societyId, true);
  const record = useRecordPayment(societyId);
  const [flatId, setFlatId] = useState<string | undefined>(initialFlat);
  const account = useFlatAccount(societyId, flatId ?? '');
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(() => new Date());
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [flatOpen, setFlatOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per open form: a double tap or a retry after a timeout records the payment once.
  const [key] = useState(newIdempotencyKey);

  const owes = flatId ? account.data?.outstandingPaise : undefined;
  useEffect(() => {
    if (owes !== undefined && amount === '' && owes > 0) setAmount(rupeesText(owes));
  }, [owes, amount]);

  const rows = collection.data?.rows ?? [];
  const selected = rows.find((r) => r.flat.id === flatId);
  const paise = parseRupees(amount);
  const today = isoDay(new Date());
  const yesterday = isoDay(new Date(Date.now() - 86_400_000));
  const paidOnDay = isoDay(paidOn);

  const save = async () => {
    setError(null);
    if (!flatId || !paise) {
      setError(t('common:validation.required'));
      return;
    }
    try {
      const p = await record.mutateAsync({
        flatId,
        amountPaise: paise,
        paidOn: paidOnDay,
        method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        idempotencyKey: key,
      });
      toast.show(t('money:record.saved'));
      nav.replace('Receipt', { paymentId: p.id });
    } catch (e) {
      setError(toMessage(e));
    }
  };

  return (
    <>
      <Screen bottomBar>
        <TitleBar title={t('money:record.title')} onBack={() => nav.goBack()} />
        <View className="mt-6 gap-3">
          <SelectField
            label={t('money:record.flat')}
            value={selected ? formatFlat(selected.flat) : undefined}
            placeholder={t('money:record.pickFlat')}
            onPress={() => setFlatOpen(true)}
          />
          {owes !== undefined ? (
            <Text variant="label" tone="secondary">
              {owes > 0
                ? t('money:record.owes', { amount: money(owes) })
                : t('money:record.nothingDue')}
            </Text>
          ) : null}
          <Input
            label={t('money:record.amount')}
            helper={
              paise && owes !== undefined && paise > owes
                ? t('money:record.advanceHint')
                : t('money:record.amountHint')
            }
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="2500"
          />
          <View>
            <Text variant="label" tone="secondary" className="mb-1.5">
              {t('money:record.paidOn')}
            </Text>
            <View className="flex-row gap-2">
              <Chip
                label={t('common:time.today')}
                selected={paidOnDay === today}
                onPress={() => setPaidOn(new Date())}
              />
              <Chip
                label={t('common:time.yesterday')}
                selected={paidOnDay === yesterday}
                onPress={() => setPaidOn(new Date(Date.now() - 86_400_000))}
              />
              <Chip
                icon="calendar"
                label={
                  paidOnDay === today || paidOnDay === yesterday
                    ? t('common:picker.date')
                    : day(paidOnDay, 'short')
                }
                selected={paidOnDay !== today && paidOnDay !== yesterday}
                onPress={() => setDateOpen(true)}
              />
            </View>
          </View>
          <View>
            <Text variant="label" tone="secondary" className="mb-1.5">
              {t('money:record.method')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-5"
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            >
              {PaymentMethodSchema.options.map((m) => (
                <Chip
                  key={m}
                  label={t(`money:method.${m}`)}
                  selected={method === m}
                  onPress={() => setMethod(m)}
                />
              ))}
            </ScrollView>
          </View>
          <Input
            label={t('money:record.reference')}
            placeholder={t('money:record.referenceHint')}
            value={reference}
            onChangeText={setReference}
            maxLength={80}
          />
          <Input
            label={t('money:record.notes')}
            value={notes}
            onChangeText={setNotes}
            maxLength={500}
          />
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </View>
      </Screen>
      <BottomBar
        action={
          <View className="flex-row items-center gap-4">
            {paise ? <Text variant="h2">{money(paise)}</Text> : null}
            <Button
              label={t('money:record.save')}
              inline
              loading={record.isPending}
              onPress={() => void save()}
            />
          </View>
        }
      />
      <OptionSheet
        visible={flatOpen}
        onClose={() => setFlatOpen(false)}
        title={t('money:record.pickFlat')}
        value={flatId}
        options={rows.map((r) => ({
          value: r.flat.id,
          label: formatFlat(r.flat),
          hint: r.outstandingPaise
            ? t('money:record.owes', { amount: money(r.outstandingPaise) })
            : t('money:record.nothingDue'),
        }))}
        onSelect={(id) => {
          setFlatId(id);
          setAmount('');
        }}
      />
      <DateTimeSheet
        visible={dateOpen}
        onClose={() => setDateOpen(false)}
        mode="date"
        pastDays={120}
        days={1}
        title={t('money:record.paidOn')}
        value={paidOn}
        onChange={setPaidOn}
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
