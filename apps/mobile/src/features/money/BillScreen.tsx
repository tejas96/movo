import {
  Button,
  Card,
  Divider,
  IconSquare,
  Input,
  OptionSheet,
  Row,
  Screen,
  SectionHeader,
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
import { formatFlat, useCan, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { day, money } from '../../core/util/money';
import { useBill, useBillAction } from './api';
import { BillStatusPill, billName } from './shared';

type Action = 'waive' | 'waiveLateFee';

export function BillScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const { billId } = useRoute<RouteProp<RootStackParamList, 'Bill'>>().params;
  const bill = useBill(societyId, billId);
  const action = useBillAction(societyId, billId);
  const canWaive = useCan('maintenance.waive');
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const b = bill.data;
  const open = b ? b.status !== 'PAID' && b.status !== 'WAIVED' : false;
  const mine = b ? tenant.flats.some((f) => f.id === b.flat.id) : false;

  const options: { value: Action; label: string }[] =
    b && open && canWaive
      ? [
          ...(b.lateFeePaise > 0
            ? [{ value: 'waiveLateFee' as const, label: t('money:bill.waiveLateFee') }]
            : []),
          { value: 'waive', label: t('money:bill.waive') },
        ]
      : [];

  const submit = async () => {
    if (!sheet || reason.trim().length < 2) return;
    try {
      await action.mutateAsync({ action: sheet, reason: reason.trim() });
      toast.show(sheet === 'waive' ? t('money:bill.waived') : t('money:bill.lateFeeWaived'));
      setSheet(null);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen>
      <TitleBar
        title={t('money:bill.title')}
        onBack={() => nav.goBack()}
        trailing={
          options.length > 0 ? (
            <IconSquare icon="more" variant="linear" onPress={() => setMenu(true)} />
          ) : undefined
        }
      />
      {bill.isLoading || !b ? (
        <Skeleton className="mt-6 h-64 rounded-xl" />
      ) : (
        <>
          <Card className="mt-6">
            <View className="flex-row items-center justify-between">
              <Text variant="label" tone="secondary">
                {`${formatFlat(b.flat)} · ${t('money:dueOn', { date: day(b.dueDate) })}`}
              </Text>
              <BillStatusPill status={b.status} />
            </View>
            <Text variant="h2" className="mt-2">
              {billName(b)}
            </Text>
            <Text variant="display">{money(open ? b.outstandingPaise : b.totalPaise)}</Text>
            <Divider />
            <View className="gap-2">
              {b.lines.map((l) => (
                <Line
                  key={l.type}
                  label={l.type === 'LATE_FEE' ? t('money:lateFee') : l.label}
                  value={money(l.amountPaise)}
                />
              ))}
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
            {open && mine ? (
              <Button
                className="mt-5"
                icon="upi"
                label={t('money:howToPay')}
                onPress={() =>
                  nav.navigate('HowToPay', {
                    amountPaise: b.outstandingPaise,
                    note: `${formatFlat(b.flat)} ${billName(b)}`,
                  })
                }
              />
            ) : null}
          </Card>
          {b.payments.length > 0 ? (
            <>
              <SectionHeader title={t('money:bill.payments')} />
              <Card tight className="gap-2">
                {b.payments.map((p) => (
                  <Row
                    key={p.paymentId}
                    icon="receipt"
                    title={day(p.paidOn)}
                    subtitle={`${t(`money:method.${p.method}`)} · ${p.receiptNo}`}
                    trailing={
                      <Text variant="bodyMedium" className="font-semibold">
                        {money(p.amountPaise)}
                      </Text>
                    }
                    onPress={() => nav.navigate('Receipt', { paymentId: p.paymentId })}
                  />
                ))}
              </Card>
            </>
          ) : null}
        </>
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

export function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text
        variant={strong ? 'bodyMedium' : 'body'}
        tone={strong ? 'primary' : 'secondary'}
        className="flex-1"
      >
        {label}
      </Text>
      <Text variant="bodyMedium" className={strong ? 'font-semibold' : undefined}>
        {value}
      </Text>
    </View>
  );
}
