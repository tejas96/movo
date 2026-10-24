import {
  Button,
  Card,
  Coin,
  Divider,
  Glass,
  IconSquare,
  Input,
  OptionSheet,
  Rise,
  Row,
  Screen,
  SectionLabel,
  Sheet,
  Skeleton,
  Text,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatFlat, useSocietyId } from '../../core/tenant/hooks';
import { DetailHero, HeroPill } from '../../core/ui/DetailHero';
import { Line } from '../../core/ui/Line';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { day } from '../../core/util/date';
import { money } from '../../core/util/money';
import { useBill, useBillAction } from './api';
import { ArtIcon, BillStatusPill, billName } from './shared';

type Action = 'waive' | 'waiveLateFee';

export function BillScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const toast = useToast();
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const { billId } = useRoute<RouteProp<RootStackParamList, 'Bill'>>().params;
  const bill = useBill(societyId, billId);
  const action = useBillAction(societyId, billId);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const b = bill.data;
  const open = b ? b.status !== 'PAID' && b.status !== 'WAIVED' : false;

  const options: { value: Action; label: string }[] = b?.canWaive
    ? [
        ...(b.canWaiveLateFee
          ? [{ value: 'waiveLateFee' as const, label: t('money:bill.waiveLateFee') }]
          : []),
        { value: 'waive', label: t('money:bill.waive') },
      ]
    : [];

  const submit = async () => {
    if (!sheet || reason.trim().length < 2) return;
    await withErrorToast(async () => {
      await action.mutateAsync({ action: sheet, reason: reason.trim() });
      toast.show(sheet === 'waive' ? t('money:bill.waived') : t('money:bill.lateFeeWaived'));
      setSheet(null);
    });
  };

  return (
    <Screen>
      {loadFailed(bill) ? (
        <QueryError query={bill} className="mt-6" />
      ) : bill.isLoading || !b ? (
        <View className="gap-3">
          <Skeleton className="h-[312px] rounded-[40px]" />
          <Skeleton className="h-48 rounded-[30px]" />
        </View>
      ) : (
        <View style={styles.page}>
          <Rise>
            <DetailHero
              art="sunset"
              height={280}
              onBack={() => nav.goBack()}
              trailing={
                options.length > 0 ? (
                  <IconSquare
                    icon="more"
                    variant="linear"
                    diameter={46}
                    onPress={() => setMenu(true)}
                    accessibilityLabel={t('common:actions.more')}
                  />
                ) : undefined
              }
              drawing={
                <View style={styles.coins}>
                  <Coin size={70} />
                  <Coin size={38} tone="pale" delay={400} style={styles.coinSmall} />
                </View>
              }
              pills={
                <>
                  <HeroPill label={billName(b)} />
                  <BillStatusPill status={b.status} />
                </>
              }
              title={money(open ? b.outstandingPaise : b.totalPaise)}
              meta={`${formatFlat(b.flat)} · ${t('money:dueOn', { date: day(b.dueDate) })}`}
            />
          </Rise>
          <Rise delay={80}>
            <Glass radius={30} style={styles.card}>
              <SectionLabel className="px-0 pt-0 pb-2">{t('money:bill.title')}</SectionLabel>
              <View className="gap-2">
                {b.lines.map((l) => (
                  <Line
                    key={l.type}
                    label={l.type === 'LATE_FEE' ? t('money:lateFee') : l.label}
                    value={money(l.amountPaise)}
                  />
                ))}
                <Divider className="my-2" />
                <Line label={t('money:bill.total')} value={money(b.totalPaise)} strong />
                {b.paidPaise > 0 ? (
                  <Line label={t('money:bill.paid')} value={`− ${money(b.paidPaise)}`} />
                ) : null}
                {open ? (
                  <Line label={t('money:bill.left')} value={money(b.outstandingPaise)} strong />
                ) : null}
              </View>
              {b.waivedReason ? (
                <Text variant="label" tone="secondary" className="mt-4">
                  {t('money:bill.waivedNote', { reason: b.waivedReason })}
                </Text>
              ) : null}
            </Glass>
          </Rise>
          {b.canPay ? (
            <Rise delay={120}>
              <Button
                size="xl"
                arrow
                label={t('money:howToPay')}
                onPress={() =>
                  nav.navigate('HowToPay', {
                    amountPaise: b.outstandingPaise,
                    note: `${formatFlat(b.flat)} ${billName(b)}`,
                  })
                }
              />
            </Rise>
          ) : null}
          {b.payments.length > 0 ? (
            <Rise delay={160}>
              <Card tight>
                <SectionLabel>{t('money:bill.payments')}</SectionLabel>
                {b.payments.map((p) => (
                  <Row
                    key={p.paymentId}
                    leading={<ArtIcon art="tileSage" icon="receipt" />}
                    title={day(p.paidOn)}
                    subtitle={`${t(`money:method.${p.method}`)} · ${p.receiptNo}`}
                    trailing={
                      <Text variant="title" numberOfLines={1}>
                        {money(p.amountPaise)}
                      </Text>
                    }
                    onPress={() => nav.navigate('Receipt', { paymentId: p.paymentId })}
                  />
                ))}
              </Card>
            </Rise>
          ) : null}
        </View>
      )}
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        options={options}
        onSelect={(a) => {
          setReason('');
          setSheet(a);
        }}
      />
      <Sheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === 'waive' ? t('money:bill.waive') : t('money:bill.waiveLateFee')}
        footer={
          <Button
            label={sheet === 'waive' ? t('money:bill.waive') : t('money:bill.waiveLateFee')}
            variant="danger"
            loading={action.isPending}
            disabled={reason.trim().length < 2}
            onPress={() => void submit()}
          />
        }
      >
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
  coins: { width: 140, height: 90, alignItems: 'center' },
  coinSmall: { position: 'absolute', right: 6, top: 48 },
});
