import type { BillStatus, BillSummary, CollectionStatus, PaymentSummary } from '@movo/contracts';
import {
  ArtFill,
  type ArtName,
  Icon,
  type IconName,
  Row,
  StatusPill as SoftPill,
  Text,
  theme,
} from '@movo/design-system';
import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { StatusPill, type StatusTones } from '../../core/ui/StatusPill';
import { day, periodLabel } from '../../core/util/date';
import { money } from '../../core/util/money';

const BILL_TONE: StatusTones<BillStatus> = {
  DUE: 'warning',
  PARTIALLY_PAID: 'warning',
  OVERDUE: 'danger',
  PAID: 'success',
  WAIVED: 'neutral',
};

const COLLECTION_TONE: StatusTones<CollectionStatus> = {
  PAID: 'success',
  DUE: 'warning',
  OVERDUE: 'danger',
  NO_BILLS: 'neutral',
};

export function BillStatusPill({ status }: { status: BillStatus }) {
  return <StatusPill value={status} tones={BILL_TONE} labels="money:status" />;
}

export function CollectionPill({ status }: { status: CollectionStatus }) {
  return <StatusPill value={status} tones={COLLECTION_TONE} labels="money:collectionStatus" dot />;
}

/** "Maintenance · Oct 2026", or just the title for a one-off bill. */
export function billName(b: { title: string; periodKey: string | null }): string {
  return b.periodKey ? `${b.title} · ${periodLabel(b.periodKey)}` : b.title;
}

function Amount({ paise, children }: { paise: number; children?: ReactNode }) {
  return (
    <View className="items-end gap-1">
      <Text variant="title">{money(paise)}</Text>
      {children}
    </View>
  );
}

/** A small round colour-art disc with an icon: the leading mark of Money rows. */
export function ArtIcon({ art, icon }: { art: ArtName; icon: IconName }) {
  return (
    <ArtFill art={art} radius={24} fade={0} blur={14} style={artIconStyle}>
      <View className="flex-1 items-center justify-center">
        <Icon name={icon} size={20} color={theme.color.icon.primary} />
      </View>
    </ArtFill>
  );
}

const artIconStyle = { width: 48, height: 48 };

export function BillRow({ bill, onGray }: { bill: BillSummary; onGray?: boolean }) {
  const { t } = useTranslation('money');
  const nav = useNav();
  const open = bill.status !== 'PAID' && bill.status !== 'WAIVED';
  return (
    <Row
      leading={<ArtIcon art="tileFlame" icon="receipt" />}
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

export const PaymentRow = memo(function PaymentRow({
  payment,
  showFlat,
  onGray,
}: {
  payment: PaymentSummary;
  showFlat?: boolean;
  /** Inside a glass list: no fill of its own. */
  onGray?: boolean;
}) {
  const { t } = useTranslation('money');
  const nav = useNav();
  const flat = payment.flat.buildingName
    ? `${payment.flat.buildingName}-${payment.flat.number}`
    : payment.flat.number;
  return (
    <Row
      leading={<ArtIcon art="tileSage" icon="receipt" />}
      onGray={onGray}
      title={showFlat ? `${flat} · ${day(payment.paidOn, 'short')}` : day(payment.paidOn)}
      subtitle={[t(`method.${payment.method}`), payment.receiptNo].join(' · ')}
      trailing={
        <Amount paise={payment.amountPaise}>
          {payment.status === 'REVERSED' ? (
            <SoftPill label={t('receipt.reversed')} tone="neutral" />
          ) : null}
        </Amount>
      }
      onPress={() => nav.navigate('Receipt', { paymentId: payment.id })}
    />
  );
});
