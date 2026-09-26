import {
  BottomBar,
  Button,
  Card,
  Divider,
  IconSquare,
  Input,
  Screen,
  Sheet,
  Skeleton,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId, useTenant } from '../../core/tenant/hooks';
import { day, money } from '../../core/util/money';
import { relative } from '../../core/util/time';
import { Line } from '../money/BillScreen';
import { CATEGORY_ICON } from '../services/shared';
import { useDecideExpense, useExpense, useRemoveExpense } from './api';
import { ExpenseStatusPill, expenseCategoryLabel } from './shared';

export function ExpenseDetailScreen() {
  const { t } = useTranslation(['expenses', 'money', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const { expenseId } = useRoute<RouteProp<RootStackParamList, 'ExpenseDetail'>>().params;
  const expense = useExpense(societyId, expenseId);
  const decide = useDecideExpense(societyId, expenseId);
  const remove = useRemoveExpense(societyId, expenseId);
  const [sheet, setSheet] = useState<'reject' | 'remove' | null>(null);
  const [reason, setReason] = useState('');
  const e = expense.data;
  const mine = e?.createdBy.membershipId === tenant.id;

  const run = async (approve: boolean) => {
    try {
      await decide.mutateAsync({ approve, reason: reason.trim() });
      toast.show(approve ? t('expenses:detail.approved') : t('expenses:detail.rejected'));
      setSheet(null);
    } catch (err) {
      toast.show(toMessage(err), 'error');
    }
  };

  const drop = async () => {
    try {
      await remove.mutateAsync();
      toast.show(t('expenses:detail.removed'));
      nav.goBack();
    } catch (err) {
      toast.show(toMessage(err), 'error');
    }
  };

  return (
    <>
      <Screen bottomBar={Boolean(e?.canDecide)}>
        <TitleBar
          title={t('expenses:detail.title')}
          onBack={() => nav.goBack()}
          trailing={
            e?.canEdit ? (
              <IconSquare
                icon="edit"
                variant="linear"
                onPress={() => nav.navigate('ExpenseEditor', { expenseId })}
              />
            ) : undefined
          }
        />
        {expense.isLoading || !e ? (
          <Skeleton className="mt-6 h-64 rounded-xl" />
        ) : (
          <>
            <Card className="mt-6">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <IconSquare icon={CATEGORY_ICON[e.category.icon]} size="sm" tone="white" />
                  <Text variant="label" tone="secondary">
                    {expenseCategoryLabel(e.category)}
                  </Text>
                </View>
                <ExpenseStatusPill status={e.status} />
              </View>
              {e.description ? (
                <Text variant="h2" className="mt-3">
                  {e.description}
                </Text>
              ) : null}
              <Text variant="display">{money(e.amountPaise)}</Text>
              <Divider />
              <View className="gap-2">
                <Line label={t('expenses:detail.paidTo')} value={e.payeeName} />
                <Line label={t('expenses:detail.paidOn')} value={day(e.incurredOn)} />
                <Line label={t('expenses:detail.method')} value={t(`money:method.${e.method}`)} />
                {e.reference ? (
                  <Line label={t('expenses:detail.reference')} value={e.reference} />
                ) : null}
              </View>
              <Divider />
              <Text variant="label" tone="secondary">
                {`${t('expenses:detail.addedBy', { name: e.createdBy.displayName })} · ${relative(e.createdAt)}`}
              </Text>
              {e.decidedBy ? (
                <Text variant="label" tone="secondary" className="mt-1">
                  {e.status === 'REJECTED'
                    ? t('expenses:detail.rejectedBy', { name: e.decidedBy.displayName })
                    : t('expenses:detail.approvedBy', { name: e.decidedBy.displayName })}
                </Text>
              ) : null}
              {e.rejectionReason ? (
                <Text variant="label" tone="danger" className="mt-1">
                  {`${t('expenses:detail.reason')}: ${e.rejectionReason}`}
                </Text>
              ) : null}
              {e.status === 'PENDING' && mine ? (
                <Text variant="label" tone="secondary" className="mt-3">
                  {t('expenses:detail.ownNote')}
                </Text>
              ) : null}
            </Card>
            {e.canEdit ? (
              <Button
                className="mt-4"
                variant="ghost"
                label={t('expenses:detail.remove')}
                onPress={() => setSheet('remove')}
              />
            ) : null}
          </>
        )}
      </Screen>
      {e?.canDecide ? (
        <BottomBar
          action={
            <View className="flex-row items-center gap-2">
              <Button
                label={t('expenses:detail.reject')}
                variant="gray"
                inline
                onPress={() => {
                  setReason('');
                  setSheet('reject');
                }}
              />
              <Button
                label={t('expenses:detail.approve')}
                inline
                loading={decide.isPending && sheet === null}
                onPress={() => void run(true)}
              />
            </View>
          }
        />
      ) : null}
      <Sheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === 'reject' ? t('expenses:detail.rejectTitle') : t('expenses:detail.remove')}
        footer={
          sheet === 'reject' ? (
            <Button
              label={t('expenses:detail.reject')}
              variant="danger"
              loading={decide.isPending}
              disabled={reason.trim().length < 2}
              onPress={() => void run(false)}
            />
          ) : (
            <Button
              label={t('expenses:detail.remove')}
              variant="danger"
              loading={remove.isPending}
              onPress={() => void drop()}
            />
          )
        }
      >
        {sheet === 'reject' ? (
          <Input
            white
            label={t('expenses:detail.reason')}
            value={reason}
            onChangeText={setReason}
            maxLength={300}
          />
        ) : (
          <Text variant="body" tone="secondary">
            {e ? `${e.payeeName} · ${money(e.amountPaise)}` : ''}
          </Text>
        )}
      </Sheet>
    </>
  );
}
