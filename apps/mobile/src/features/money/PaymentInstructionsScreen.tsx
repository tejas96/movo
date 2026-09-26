import type { PaymentInstruction } from '@movo/contracts';
import {
  Button,
  Card,
  EmptyState,
  IconSquare,
  Input,
  Row,
  Screen,
  Segmented,
  Sheet,
  Skeleton,
  StatusPill,
  Text,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { useDeleteInstruction, useInstructions, useSaveInstruction } from './api';

type Kind = PaymentInstruction['kind'];

export function PaymentInstructionsScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const list = useInstructions(societyId);
  const save = useSaveInstruction(societyId);
  const remove = useDeleteInstruction(societyId);
  const [editing, setEditing] = useState<PaymentInstruction | 'new' | null>(null);
  const [kind, setKind] = useState<Kind>('UPI');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [payee, setPayee] = useState('');
  const [show, setShow] = useState(true);

  const open = (i: PaymentInstruction | 'new') => {
    setEditing(i);
    setKind(i === 'new' ? 'UPI' : i.kind);
    setLabel(i === 'new' ? '' : i.label);
    setValue(i === 'new' ? '' : i.value);
    setPayee(i === 'new' ? '' : (i.payeeName ?? ''));
    setShow(i === 'new' ? true : i.isActive);
  };

  const submit = async () => {
    try {
      await save.mutateAsync({
        id: editing && editing !== 'new' ? editing.id : undefined,
        body: {
          kind,
          label: label.trim(),
          value: value.trim(),
          payeeName: payee.trim() || null,
          isActive: show,
        },
      });
      toast.show(t('money:instructions.saved'));
      setEditing(null);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  const drop = async () => {
    if (!editing || editing === 'new') return;
    try {
      await remove.mutateAsync(editing.id);
      setEditing(null);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  const items = list.data ?? [];
  return (
    <Screen>
      <TitleBar
        title={t('money:instructions.title')}
        onBack={() => nav.goBack()}
        trailing={<IconSquare icon="add" variant="linear" tone="ink" onPress={() => open('new')} />}
      />
      {list.isLoading ? (
        <Skeleton className="mt-6 h-24 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bank"
          title={t('money:instructions.empty')}
          body={t('money:instructions.emptyBody')}
          className="mt-10"
        />
      ) : (
        <Card tight className="mt-6 gap-1">
          {items.map((i) => (
            <Row
              key={i.id}
              icon={i.kind === 'UPI' ? 'upi' : 'bank'}
              title={i.label}
              subtitle={i.value}
              trailing={
                i.isActive ? undefined : (
                  <StatusPill label={t('money:instructions.hidden')} tone="neutral" />
                )
              }
              onPress={() => open(i)}
            />
          ))}
        </Card>
      )}
      <Sheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? t('money:instructions.add') : t('common:actions.edit')}
        footer={
          <View className="gap-2">
            <Button
              label={t('common:actions.save')}
              loading={save.isPending}
              disabled={label.trim().length < 2 || value.trim().length < 3}
              onPress={() => void submit()}
            />
            {editing && editing !== 'new' ? (
              <Button
                label={t('money:instructions.remove')}
                variant="ghost"
                loading={remove.isPending}
                onPress={() => void drop()}
              />
            ) : null}
          </View>
        }
      >
        <View className="gap-3">
          {editing === 'new' ? (
            <Segmented
              value={kind}
              onChange={setKind}
              options={(['UPI', 'BANK', 'OTHER'] as const).map((k) => ({
                value: k,
                label: t(`money:instructions.kind.${k}`),
              }))}
            />
          ) : null}
          <Input
            label={t('money:instructions.label')}
            placeholder={t('money:instructions.labelHint')}
            value={label}
            onChangeText={setLabel}
            maxLength={60}
            white
          />
          <Input
            label={
              kind === 'UPI'
                ? t('money:instructions.value')
                : kind === 'BANK'
                  ? t('money:instructions.valueBank')
                  : t('money:instructions.valueOther')
            }
            placeholder={kind === 'UPI' ? t('money:instructions.valueHint') : undefined}
            value={value}
            onChangeText={setValue}
            autoCapitalize="none"
            multiline={kind !== 'UPI'}
            maxLength={500}
            white
          />
          <Input
            label={t('money:instructions.payee')}
            value={payee}
            onChangeText={setPayee}
            maxLength={60}
            white
          />
          <View className="flex-row items-center justify-between rounded-md bg-card-nested px-[18px] py-3">
            <Text variant="body">{t('money:instructions.show')}</Text>
            <Toggle value={show} onValueChange={setShow} />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}
