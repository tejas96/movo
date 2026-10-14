import {
  MAX_PAYMENT_PROOFS,
  maintenanceContract,
  type PaymentMethod,
  PaymentMethodSchema,
} from '@movo/contracts';
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
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { bodyResolver, formMessage } from '../../core/forms/contract-form';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { PhotoField, usePhotoPicker } from '../../core/photos/PhotoPickerRow';
import { formatFlat, useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { day, isoDay, localeTag } from '../../core/util/date';
import { money, newIdempotencyKey, parseRupees, rupeesText } from '../../core/util/money';
import { useCollection, useFlatAccount, useRecordPayment } from './api';

interface PaymentForm {
  flatId: string | undefined;
  amount: string;
  paidOn: Date;
  method: PaymentMethod;
  reference: string;
  notes: string;
}

/** Proof uploads and the idempotency key live outside the form but go in the same body. */
interface PaymentExtra {
  proofIds: string[];
  idempotencyKey: string;
}

function toBody(v: PaymentForm, x: PaymentExtra) {
  return {
    flatId: v.flatId ?? '',
    amountPaise: parseRupees(v.amount) ?? 0,
    paidOn: isoDay(v.paidOn),
    method: v.method,
    reference: v.reference.trim() || null,
    notes: v.notes.trim() || null,
    proofIds: x.proofIds,
    idempotencyKey: x.idempotencyKey,
  };
}

export function RecordPaymentScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const initialFlat = useRoute<RouteProp<RootStackParamList, 'RecordPayment'>>().params?.flatId;
  const collection = useCollection(societyId, true);
  const record = useRecordPayment(societyId);
  const [flatOpen, setFlatOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  // One key per open form: a double tap or a retry after a timeout records the payment once.
  const [key] = useState(newIdempotencyKey);
  const proofs = usePhotoPicker(societyId, { kind: 'PAYMENT_PROOF', max: MAX_PAYMENT_PROOFS });
  const extra: PaymentExtra = { proofIds: proofs.ids, idempotencyKey: key };
  const [empty] = useState(
    (): PaymentForm => ({
      flatId: initialFlat,
      amount: '',
      paidOn: new Date(),
      method: 'UPI',
      reference: '',
      notes: '',
    }),
  );
  const form = useForm<PaymentForm>({
    resolver: bodyResolver(maintenanceContract.recordPayment.body, (v: PaymentForm) =>
      toBody(v, extra),
    ),
    defaultValues: empty,
    reValidateMode: 'onSubmit',
  });
  const error = formMessage(form, t('common:validation.required'));
  const { flatId, amount, paidOn, method } = form.watch();
  const account = useFlatAccount(societyId, flatId ?? '');

  const owes = flatId ? account.data?.outstandingPaise : undefined;
  useEffect(() => {
    if (owes !== undefined && amount === '' && owes > 0) form.setValue('amount', rupeesText(owes));
  }, [owes, amount, form]);

  const rows = collection.data?.rows ?? [];
  const selected = rows.find((r) => r.flat.id === flatId);
  const paise = parseRupees(amount);
  const today = isoDay(new Date());
  const yesterday = isoDay(new Date(Date.now() - 86_400_000));
  const paidOnDay = isoDay(paidOn);

  const save = form.handleSubmit(async (values) => {
    if (proofs.uploading) {
      form.setError('root.server', { message: t('common:photo.uploading') });
      return;
    }
    try {
      const p = await record.mutateAsync(toBody(values, extra));
      toast.show(t('money:record.saved'));
      nav.replace('Receipt', { paymentId: p.id });
    } catch (e) {
      form.setError('root.server', { message: toMessage(e) });
    }
  });

  if (loadFailed(collection))
    return (
      <Screen>
        <TitleBar title={t('money:record.title')} onBack={() => nav.goBack()} />
        <QueryError query={collection} className="mt-10" />
      </Screen>
    );

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
          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <Input
                label={t('money:record.amount')}
                helper={
                  paise && owes !== undefined && paise > owes
                    ? t('money:record.advanceHint')
                    : t('money:record.amountHint')
                }
                value={field.value}
                onChangeText={field.onChange}
                keyboardType="decimal-pad"
                placeholder="2500"
              />
            )}
          />
          <View>
            <Text variant="label" tone="secondary" className="mb-1.5">
              {t('money:record.paidOn')}
            </Text>
            <View className="flex-row gap-2">
              <Chip
                label={t('common:time.today')}
                selected={paidOnDay === today}
                onPress={() => form.setValue('paidOn', new Date())}
              />
              <Chip
                label={t('common:time.yesterday')}
                selected={paidOnDay === yesterday}
                onPress={() => form.setValue('paidOn', new Date(Date.now() - 86_400_000))}
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
                  onPress={() => form.setValue('method', m)}
                />
              ))}
            </ScrollView>
          </View>
          <Controller
            control={form.control}
            name="reference"
            render={({ field }) => (
              <Input
                label={t('money:record.reference')}
                placeholder={t('money:record.referenceHint')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={80}
              />
            )}
          />
          <Controller
            control={form.control}
            name="notes"
            render={({ field }) => (
              <Input
                label={t('money:record.notes')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={500}
              />
            )}
          />
          <PhotoField
            label={t('money:record.proofs')}
            help={t('money:record.proofsHelp')}
            picker={proofs}
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
              disabled={proofs.uploading}
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
          form.setValue('flatId', id);
          form.setValue('amount', '');
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
        onChange={(d) => form.setValue('paidOn', d)}
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
