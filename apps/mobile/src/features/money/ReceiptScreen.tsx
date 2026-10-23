import {
  Button,
  Divider,
  Glass,
  IconSquare,
  Input,
  Rise,
  Screen,
  SectionLabel,
  Sheet,
  Skeleton,
  StatusPill,
  Text,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet, View } from 'react-native';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { PhotoSection } from '../../core/photos/PhotoStrip';
import { formatFlat, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { DetailHero, HeroPill } from '../../core/ui/DetailHero';
import { Line } from '../../core/ui/Line';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { day } from '../../core/util/date';
import { money } from '../../core/util/money';
import { usePayment, useReversePayment } from './api';
import { billName } from './shared';

export function ReceiptScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const toast = useToast();
  const withErrorToast = useMutationToast();
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
    await withErrorToast(async () => {
      await reverse.mutateAsync(reason.trim());
      toast.show(t('money:receipt.reversedToast'));
      setSheet(false);
    });
  };

  return (
    <Screen>
      {loadFailed(payment) ? (
        <QueryError query={payment} className="mt-6" />
      ) : payment.isLoading || !p ? (
        <View className="gap-3">
          <Skeleton className="h-[292px] rounded-[40px]" />
          <Skeleton className="h-60 rounded-[30px]" />
        </View>
      ) : (
        <View style={styles.page}>
          <Rise>
            <DetailHero
              art={p.status === 'REVERSED' ? 'tilePink' : 'meadow'}
              height={280}
              onBack={() => nav.goBack()}
              trailing={
                p.status === 'RECORDED' ? (
                  <IconSquare
                    icon="share"
                    variant="linear"
                    diameter={46}
                    onPress={share}
                    accessibilityLabel={t('money:receipt.share')}
                  />
                ) : undefined
              }
              icon={{ name: p.status === 'REVERSED' ? 'warning' : 'taskDone', motion: 'bob' }}
              pills={
                <>
                  <HeroPill label={t('money:receipt.number', { no: p.receiptNo })} />
                  {p.status === 'REVERSED' ? (
                    <StatusPill label={t('money:receipt.reversed')} tone="danger" />
                  ) : (
                    <StatusPill label={t('money:status.PAID')} tone="success" dot />
                  )}
                </>
              }
              title={money(p.amountPaise)}
              meta={`${tenant.society.name} · ${day(p.paidOn)}`}
            />
          </Rise>
          <Rise delay={80}>
            <Glass radius={30} style={styles.card}>
              <SectionLabel className="px-0 pt-0 pb-2">{t('money:receipt.title')}</SectionLabel>
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
                  <Divider className="my-4" />
                  <SectionLabel className="px-0 pt-0 pb-2">
                    {t('money:receipt.appliedTo')}
                  </SectionLabel>
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
            </Glass>
          </Rise>
          <PhotoSection title={t('money:receipt.proofs')} photos={p.proofs} />
          {p.status === 'RECORDED' ? (
            <Button size="xl" arrow label={t('money:receipt.share')} onPress={share} />
          ) : null}
          {p.canReverse ? (
            <Button
              variant="ghost"
              label={t('money:receipt.reverse')}
              onPress={() => {
                setReason('');
                setSheet(true);
              }}
            />
          ) : null}
        </View>
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

const styles = StyleSheet.create({
  page: { gap: 14, marginHorizontal: -4 },
  card: { padding: 18 },
});
