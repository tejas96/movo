import {
  type Expense,
  expensesContract,
  MAX_EXPENSE_RECEIPTS,
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
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { bodyResolver, formMessage, usePrefill } from '../../core/forms/contract-form';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { PhotoField, usePhotoPicker } from '../../core/photos/PhotoPickerRow';
import { useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { day, fromIsoDay, isoDay, localeTag } from '../../core/util/date';
import { money, newIdempotencyKey, parseRupees, rupeesText } from '../../core/util/money';
import { useExpense, useExpenseCategories, useSaveExpense } from './api';
import { expenseCategoryLabel } from './shared';

interface ExpenseForm {
  categoryId: string | undefined;
  amount: string;
  date: Date;
  payee: string;
  description: string;
  method: PaymentMethod;
  reference: string;
}

const EMPTY: Omit<ExpenseForm, 'date'> = {
  categoryId: undefined,
  amount: '',
  payee: '',
  description: '',
  method: 'BANK_TRANSFER',
  reference: '',
};

function toForm(e: Expense): ExpenseForm {
  return {
    categoryId: e.category.id,
    amount: rupeesText(e.amountPaise),
    date: fromIsoDay(e.incurredOn),
    payee: e.payeeName,
    description: e.description ?? '',
    method: e.method,
    reference: e.reference ?? '',
  };
}

/** The form part of the body. Receipts and the idempotency key are added at submit. */
function toBody(v: ExpenseForm) {
  return {
    // Empty / unparsable values fail the schema (uuid, min 1), so they are never sent.
    categoryId: v.categoryId ?? '',
    amountPaise: parseRupees(v.amount) ?? 0,
    incurredOn: isoDay(v.date),
    payeeName: v.payee.trim(),
    description: v.description.trim() || null,
    method: v.method,
    reference: v.reference.trim() || null,
  };
}

const formBody = expensesContract.create.body.omit({ receiptIds: true, idempotencyKey: true });

export function ExpenseEditorScreen() {
  const { t } = useTranslation(['expenses', 'money', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const expenseId = useRoute<RouteProp<RootStackParamList, 'ExpenseEditor'>>().params?.expenseId;
  const existing = useExpense(societyId, expenseId ?? '');
  const categories = useExpenseCategories(societyId);
  const save = useSaveExpense(societyId, expenseId);
  const form = useForm<ExpenseForm>({
    resolver: bodyResolver(formBody, toBody),
    defaultValues: { ...EMPTY, date: new Date() },
    reValidateMode: 'onSubmit',
  });
  // The contract caps one expense; an amount over the cap gets its own message.
  const tooBig =
    (form.formState.errors as Record<string, { type?: string } | undefined>).amountPaise?.type ===
    'too_big';
  const error = formMessage(
    form,
    tooBig ? t('expenses:form.amountMax') : t('common:validation.required'),
  );
  const { categoryId, amount, date, method } = form.watch();
  const [sheet, setSheet] = useState<'category' | 'date' | null>(null);
  const [key] = useState(newIdempotencyKey);
  const receipts = usePhotoPicker(societyId, {
    kind: 'EXPENSE_RECEIPT',
    max: MAX_EXPENSE_RECEIPTS,
  });
  const { reset: resetReceipts } = receipts;

  usePrefill(form, expenseId ? existing.data : undefined, (e) => {
    resetReceipts(e.receipts);
    return toForm(e);
  });

  const category = categories.data?.find((c) => c.id === categoryId);
  const paise = parseRupees(amount);

  const submit = form.handleSubmit(async (values) => {
    if (receipts.uploading) {
      form.setError('root.server', { message: t('common:photo.uploading') });
      return;
    }
    try {
      const e = await save.mutateAsync({
        ...toBody(values),
        receiptIds: receipts.ids,
        idempotencyKey: key,
      });
      toast.show(t('expenses:form.saved'));
      if (expenseId) nav.goBack();
      else nav.replace('ExpenseDetail', { expenseId: e.id });
    } catch (err) {
      form.setError('root.server', { message: toMessage(err) });
    }
  });

  if (expenseId && loadFailed(existing))
    return (
      <Screen>
        <TitleBar title={t('expenses:edit')} onBack={() => nav.goBack()} />
        <QueryError query={existing} className="mt-10" />
      </Screen>
    );

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={expenseId ? t('expenses:edit') : t('expenses:new')}
          onBack={() => nav.goBack()}
        />
        <View className="mt-6 gap-3">
          <SelectField
            label={t('expenses:form.category')}
            placeholder={t('expenses:form.pickCategory')}
            value={category ? expenseCategoryLabel(category) : undefined}
            onPress={() => setSheet('category')}
          />
          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <Input
                label={t('expenses:form.amount')}
                value={field.value}
                onChangeText={field.onChange}
                keyboardType="decimal-pad"
                placeholder="1200"
              />
            )}
          />
          <SelectField
            label={t('expenses:form.date')}
            value={day(isoDay(date))}
            onPress={() => setSheet('date')}
          />
          <Controller
            control={form.control}
            name="payee"
            render={({ field }) => (
              <Input
                label={t('expenses:form.payee')}
                placeholder={t('expenses:form.payeeHint')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={80}
              />
            )}
          />
          <Controller
            control={form.control}
            name="description"
            render={({ field }) => (
              <Input
                label={t('expenses:form.description')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={500}
              />
            )}
          />
          <View>
            <Text variant="label" tone="secondary" className="mb-1.5">
              {t('expenses:form.method')}
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
                label={t('expenses:form.reference')}
                placeholder={t('expenses:form.referenceHint')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={80}
              />
            )}
          />
          <PhotoField
            label={t('expenses:form.receipts')}
            help={t('expenses:form.receiptsHelp')}
            picker={receipts}
          />
          <Text variant="label" tone="secondary">
            {t('expenses:form.needsApproval')}
          </Text>
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
              label={t('common:actions.save')}
              inline
              loading={save.isPending}
              disabled={receipts.uploading}
              onPress={() => void submit()}
            />
          </View>
        }
      />
      <OptionSheet
        visible={sheet === 'category'}
        onClose={() => setSheet(null)}
        title={t('expenses:form.category')}
        value={categoryId}
        options={(categories.data ?? []).map((c) => ({
          value: c.id,
          label: expenseCategoryLabel(c),
        }))}
        onSelect={(id) => form.setValue('categoryId', id)}
      />
      <DateTimeSheet
        visible={sheet === 'date'}
        onClose={() => setSheet(null)}
        mode="date"
        pastDays={365}
        days={1}
        title={t('expenses:form.date')}
        value={date}
        onChange={(d) => form.setValue('date', d)}
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
