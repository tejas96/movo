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
import { useSocietyId } from '../../core/tenant/hooks';
import {
  day,
  isoDay,
  money,
  newIdempotencyKey,
  parseRupees,
  rupeesText,
} from '../../core/util/money';
import { localeTag } from '../../core/util/time';
import { useExpense, useExpenseCategories, useSaveExpense } from './api';
import { expenseCategoryLabel } from './shared';

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
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [payee, setPayee] = useState('');
  const [description, setDescription] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [sheet, setSheet] = useState<'category' | 'date' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(newIdempotencyKey);

  useEffect(() => {
    const e = existing.data;
    if (!expenseId || !e) return;
    setCategoryId(e.category.id);
    setAmount(rupeesText(e.amountPaise));
    const [y, m, d] = e.incurredOn.split('-').map(Number);
    setDate(new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1));
    setPayee(e.payeeName);
    setDescription(e.description ?? '');
    setMethod(e.method);
    setReference(e.reference ?? '');
  }, [expenseId, existing.data]);

  const category = categories.data?.find((c) => c.id === categoryId);
  const paise = parseRupees(amount);

  const submit = async () => {
    setError(null);
    if (!categoryId || !paise || payee.trim().length < 2) {
      setError(t('common:validation.required'));
      return;
    }
    try {
      const e = await save.mutateAsync({
        categoryId,
        amountPaise: paise,
        incurredOn: isoDay(date),
        payeeName: payee.trim(),
        description: description.trim() || null,
        method,
        reference: reference.trim() || null,
        idempotencyKey: key,
      });
      toast.show(t('expenses:form.saved'));
      if (expenseId) nav.goBack();
      else nav.replace('ExpenseDetail', { expenseId: e.id });
    } catch (err) {
      setError(toMessage(err));
    }
  };

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
          <Input
            label={t('expenses:form.amount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="1200"
          />
          <SelectField
            label={t('expenses:form.date')}
            value={day(isoDay(date))}
            onPress={() => setSheet('date')}
          />
          <Input
            label={t('expenses:form.payee')}
            placeholder={t('expenses:form.payeeHint')}
            value={payee}
            onChangeText={setPayee}
            maxLength={80}
          />
          <Input
            label={t('expenses:form.description')}
            value={description}
            onChangeText={setDescription}
            maxLength={500}
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
                  onPress={() => setMethod(m)}
                />
              ))}
            </ScrollView>
          </View>
          <Input
            label={t('expenses:form.reference')}
            placeholder={t('expenses:form.referenceHint')}
            value={reference}
            onChangeText={setReference}
            maxLength={80}
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
        onSelect={setCategoryId}
      />
      <DateTimeSheet
        visible={sheet === 'date'}
        onClose={() => setSheet(null)}
        mode="date"
        pastDays={365}
        days={1}
        title={t('expenses:form.date')}
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
