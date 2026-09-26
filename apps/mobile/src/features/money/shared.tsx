import type { BillStatus, BillSummary, CollectionStatus, PaymentSummary } from '@movo/contracts';
import { Row, StatusPill, type StatusTone, Text } from '@movo/design-system';
import { formatPeriod } from '@movo/i18n';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { currentLocale } from '../../core/i18n';
import { useNav } from '../../core/navigation/types';
import { day, money } from '../../core/util/money';

const BILL_TONE: Record<BillStatus, StatusTone> = {
  DUE: 'warning',
  PARTIALLY_PAID: 'warning',
  OVERDUE: 'danger',
  PAID: 'success',
  WAIVED: 'neutral',
};

const COLLECTION_TONE: Record<CollectionStatus, StatusTone> = {
  PAID: 'success',
  DUE: 'warning',
  OVERDUE: 'danger',
  NO_BILLS: 'neutral',
};

export function BillStatusPill({ status }: { status: BillStatus }) {
  const { t } = useTranslation('money');
  return <StatusPill label={t(`status.${status}`)} tone={BILL_TONE[status]} />;
}

export function CollectionPill({ status }: { status: CollectionStatus }) {
  const { t } = useTranslation('money');
  return <StatusPill label={t(`collectionStatus.${status}`)} tone={COLLECTION_TONE[status]} dot />;
}

/** "Maintenance · Oct 2026", or just the title for a one-off bill. */
export function billName(b: { title: string; periodKey: string | null }): string {
  return b.periodKey ? `${b.title} · ${formatPeriod(b.periodKey, currentLocale())}` : b.title;
}

function Amount({ paise, children }: { paise: number; children?: ReactNode }) {
  return (
    <View className="items-end gap-1">
      <Text variant="bodyMedium" className="font-semibold">
        {money(paise)}
      </Text>
      {children}
    </View>
  );
}

export function BillRow({ bill, onGray }: { bill: BillSummary; onGray?: boolean }) {
  const { t } = useTranslation('money');
  const nav = useNav();
  const open = bill.status !== 'PAID' && bill.status !== 'WAIVED';
  return (
    <Row
      icon="receipt"
      onGray={onGray}
      title={billName(bill)}
      subtitle={t('dueOn', { date: day(bill.dueDate, 'short') })}
      trailing={
        <Amount paise={open ? bill.outstandingPaise : bill.totalPaise}>
          <BillStatusPill status={bill.status} />
        </Amount>
      }
      onPress={() => nav.navigate('Bill', { billId: bill.id })}
    />
  );
}

export function PaymentRow({ payment, showFlat }: { payment: PaymentSummary; showFlat?: boolean }) {
  const { t } = useTranslation('money');
  const nav = useNav();
  const flat = payment.flat.buildingName
    ? `${payment.flat.buildingName}-${payment.flat.number}`
    : payment.flat.number;
  return (
    <Row
      icon="receipt"
      title={showFlat ? `${flat} · ${day(payment.paidOn, 'short')}` : day(payment.paidOn)}
      subtitle={[t(`method.${payment.method}`), payment.receiptNo].join(' · ')}
      trailing={
        <Amount paise={payment.amountPaise}>
          {payment.status === 'REVERSED' ? (
            <StatusPill label={t('receipt.reversed')} tone="neutral" />
          ) : null}
        </Amount>
      }
      onPress={() => nav.navigate('Receipt', { paymentId: payment.id })}
    />
  );
}
