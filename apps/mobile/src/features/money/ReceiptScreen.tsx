import {
  Button,
  Card,
  Divider,
  IconSquare,
  Input,
  Screen,
  Sheet,
  Skeleton,
  StatusPill,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatFlat, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { day, money } from '../../core/util/money';
import { usePayment, useReversePayment } from './api';
import { Line } from './BillScreen';
import { billName } from './shared';

export function ReceiptScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const { paymentId } = useRoute<RouteProp<RootStackParamList, 'Receipt'>>().params;
  const payment = usePayment(societyId, paymentId);
  const reverse = useReversePayment(societyId, paymentId);
  const [sheet, setSheet] = useState(false);
  const [reason, setReason] = useState('');
  const p = payment.data;

  const share = () => {
    if (!p) return;
    void Share.share({
      message: t('money:receipt.shareText', {
        society: tenant.society.name,
        no: p.receiptNo,
        flat: formatFlat(p.flat),
        amount: money(p.amountPaise),
        date: day(p.paidOn),
        method: t(`money:method.${p.method}`),
      }),
    });
  };

  const doReverse = async () => {
    try {
      await reverse.mutateAsync(reason.trim());
      toast.show(t('money:receipt.reversedToast'));
      setSheet(false);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen>
      <TitleBar
        title={t('money:receipt.title')}
        onBack={() => nav.goBack()}
        trailing={
          p && p.status === 'RECORDED' ? (
            <IconSquare icon="share" variant="linear" onPress={share} />
          ) : undefined
        }
      />
      {payment.isLoading || !p ? (
        <Skeleton className="mt-6 h-72 rounded-xl" />
      ) : (
        <>
          <Card className="mt-6">
            <View className="flex-row items-center justify-between">
              <Text variant="label" tone="secondary">
                {tenant.society.name}
              </Text>
              {p.status === 'REVERSED' ? (
                <StatusPill label={t('money:receipt.reversed')} tone="danger" />
              ) : (
                <StatusPill label={t('money:status.PAID')} tone="success" dot />
              )}
            </View>
            <Text variant="h2" className="mt-2">
              {t('money:receipt.number', { no: p.receiptNo })}
            </Text>
            <Text variant="display">{money(p.amountPaise)}</Text>
            <Divider />
            <View className="gap-2">
              <Line label={t('money:receipt.flat')} value={formatFlat(p.flat)} />
              <Line label={t('money:receipt.paidOn')} value={day(p.paidOn)} />
              <Line label={t('money:receipt.method')} value={t(`money:method.${p.method}`)} />
              {p.reference ? (
                <Line label={t('money:receipt.reference')} value={p.reference} />
              ) : null}
              <Line label={t('money:receipt.recordedBy')} value={p.recordedBy.displayName} />
            </View>
            {p.allocations.length > 0 || p.unallocatedPaise > 0 ? (
              <>
                <Divider />
                <Text variant="h3" className="mb-2">
                  {t('money:receipt.appliedTo')}
                </Text>
                <View className="gap-2">
                  {p.allocations.map((a) => (
                    <Line key={a.billId} label={billName(a)} value={money(a.amountPaise)} />
                  ))}
                  {p.unallocatedPaise > 0 ? (
                    <Line label={t('money:receipt.advance')} value={money(p.unallocatedPaise)} />
                  ) : null}
                </View>
              </>
            ) : null}
            {p.notes ? (
              <Text variant="label" tone="secondary" className="mt-4">
                {p.notes}
              </Text>
            ) : null}
            {p.reversedReason ? (
              <Text variant="label" tone="danger" className="mt-4">
                {`${t('money:receipt.reversed')}: ${p.reversedReason}`}
              </Text>
            ) : null}
          </Card>
          {p.status === 'RECORDED' ? (
            <Button
              className="mt-4"
              icon="share"
              variant="gray"
              label={t('money:receipt.share')}
              onPress={share}
            />
          ) : null}
          {p.canReverse ? (
            <Button
              className="mt-3"
              variant="ghost"
              label={t('money:receipt.reverse')}
              onPress={() => {
                setReason('');
                setSheet(true);
              }}
            />
          ) : null}
        </>
      )}
      <Sheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title={t('money:receipt.reverseTitle')}
        footer={
          <Button
            label={t('money:receipt.reverse')}
            variant="danger"
            loading={reverse.isPending}
            disabled={reason.trim().length < 2}
            onPress={() => void doReverse()}
          />
        }
      >
        <Text variant="label" tone="secondary" className="mb-3">
          {t('money:receipt.reverseHint')}
        </Text>
        <Input
          label={t('money:bill.reason')}
          value={reason}
          onChangeText={setReason}
          maxLength={300}
          white
        />
      </Sheet>
    </Screen>
  );
}
