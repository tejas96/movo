import { maintenanceContract } from '@movo/contracts';
import {
  BottomBar,
  Button,
  DateTimeSheet,
  Input,
  Screen,
  SelectField,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { bodyResolver, formMessage } from '../../core/forms/contract-form';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { day, isoDay, parseRupees } from '../../core/util/money';
import { localeTag } from '../../core/util/time';
import { useCreateAdhoc } from './api';

interface AdhocForm {
  title: string;
  amount: string;
  due: Date;
}

function toBody(v: AdhocForm) {
  return {
    title: v.title.trim(),
    amountPaise: parseRupees(v.amount) ?? 0,
    dueDate: isoDay(v.due),
  };
}

export function AdhocBillScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const create = useCreateAdhoc(societyId);
  const [dateOpen, setDateOpen] = useState(false);
  const [empty] = useState(
    (): AdhocForm => ({
      title: '',
      amount: '',
      due: new Date(Date.now() + 14 * 86_400_000),
    }),
  );
  const form = useForm<AdhocForm>({
    resolver: bodyResolver(maintenanceContract.createAdhocBills.body, toBody),
    defaultValues: empty,
    reValidateMode: 'onSubmit',
  });
  const error = formMessage(form, t('common:validation.required'));
  const { due } = form.watch();

  const submit = form.handleSubmit(async (values) => {
    try {
      const r = await create.mutateAsync(toBody(values));
      toast.show(t('money:adhoc.created', { count: r.created }));
      nav.goBack();
    } catch (e) {
      form.setError('root.server', { message: toMessage(e) });
    }
  });

  return (
    <>
      <Screen bottomBar>
        <TitleBar title={t('money:adhoc.title')} onBack={() => nav.goBack()} />
        <View className="mt-6 gap-3">
          <Controller
            control={form.control}
            name="title"
            render={({ field }) => (
              <Input
                label={t('money:adhoc.name')}
                placeholder={t('money:adhoc.nameHint')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={80}
              />
            )}
          />
          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <Input
                label={t('money:adhoc.amount')}
                value={field.value}
                onChangeText={field.onChange}
                keyboardType="decimal-pad"
                placeholder="5000"
              />
            )}
          />
          <SelectField
            label={t('money:adhoc.dueDate')}
            value={day(isoDay(due))}
            onPress={() => setDateOpen(true)}
          />
          <Text variant="label" tone="secondary">
            {t('money:adhoc.allFlats')}
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
          <Button
            label={t('money:adhoc.create')}
            inline
            loading={create.isPending}
            onPress={() => void submit()}
          />
        }
      />
      <DateTimeSheet
        visible={dateOpen}
        onClose={() => setDateOpen(false)}
        mode="date"
        title={t('money:adhoc.dueDate')}
        value={due}
        onChange={(d) => form.setValue('due', d)}
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
