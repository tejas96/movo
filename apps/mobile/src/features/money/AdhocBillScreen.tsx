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
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { day, isoDay, parseRupees } from '../../core/util/money';
import { localeTag } from '../../core/util/time';
import { useCreateAdhoc } from './api';

export function AdhocBillScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const create = useCreateAdhoc(societyId);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [due, setDue] = useState(() => new Date(Date.now() + 14 * 86_400_000));
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const amountPaise = parseRupees(amount);
    if (title.trim().length < 2 || !amountPaise) {
      setError(t('common:validation.required'));
      return;
    }
    try {
      const r = await create.mutateAsync({
        title: title.trim(),
        amountPaise,
        dueDate: isoDay(due),
      });
      toast.show(t('money:adhoc.created', { count: r.created }));
      nav.goBack();
    } catch (e) {
      setError(toMessage(e));
    }
  };

  return (
    <>
      <Screen bottomBar>
        <TitleBar title={t('money:adhoc.title')} onBack={() => nav.goBack()} />
        <View className="mt-6 gap-3">
          <Input
            label={t('money:adhoc.name')}
            placeholder={t('money:adhoc.nameHint')}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />
          <Input
            label={t('money:adhoc.amount')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="5000"
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
        onChange={setDue}
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
