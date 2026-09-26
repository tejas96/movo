import type { PaymentInstruction } from '@movo/contracts';
import {
  Button,
  Card,
  CircleButton,
  EmptyState,
  IconSquare,
  Screen,
  Skeleton,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Linking, Share, View } from 'react-native';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId, useTenant } from '../../core/tenant/hooks';
import { money, rupeesText } from '../../core/util/money';
import { useInstructions } from './api';

/** upi://pay link any UPI app understands. The amount is a suggestion the payer can change. */
function upiLink(i: PaymentInstruction, society: string, amountPaise?: number, note?: string) {
  const params: [string, string][] = [
    ['pa', i.value.trim()],
    ['pn', i.payeeName ?? society],
    ['cu', 'INR'],
    ...(amountPaise ? [['am', rupeesText(amountPaise)] as [string, string]] : []),
    ...(note ? [['tn', note.slice(0, 50)] as [string, string]] : []),
  ];
  // RN's URLSearchParams is incomplete, so the query is built by hand.
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
}

export function HowToPayScreen() {
  const { t } = useTranslation(['money', 'common']);
  const nav = useNav();
  const toast = useToast();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const params = useRoute<RouteProp<RootStackParamList, 'HowToPay'>>().params;
  const list = useInstructions(societyId);
  const items = list.data ?? [];

  const openUpi = async (i: PaymentInstruction) => {
    try {
      await Linking.openURL(upiLink(i, tenant.society.name, params?.amountPaise, params?.note));
    } catch {
      toast.show(t('money:pay.noUpiApp'), 'error');
    }
  };

  return (
    <Screen>
      <TitleBar title={t('money:howToPay')} onBack={() => nav.goBack()} />
      <Text variant="body" tone="secondary" className="mt-4">
        {t('money:pay.intro')}
      </Text>
      {list.isLoading ? (
        <Skeleton className="mt-5 h-40 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState icon="bank" title={t('money:pay.none')} className="mt-10" />
      ) : (
        <View className="mt-5 gap-3">
          {items.map((i) => (
            <Card key={i.id}>
              <View className="flex-row items-center gap-3">
                <IconSquare icon={i.kind === 'UPI' ? 'upi' : 'bank'} tone="white" size="sm" />
                <View className="min-w-0 flex-1">
                  <Text variant="h3">{i.label}</Text>
                  {i.payeeName ? (
                    <Text variant="label" tone="secondary">
                      {i.payeeName}
                    </Text>
                  ) : null}
                </View>
                <CircleButton
                  icon="share"
                  variant="linear"
                  tone="white"
                  size={40}
                  onPress={() => void Share.share({ message: i.value })}
                />
              </View>
              <Text variant="bodyMedium" selectable className="mt-3">
                {i.value}
              </Text>
              {i.kind === 'UPI' ? (
                <Button
                  className="mt-4"
                  icon="upi"
                  label={
                    params?.amountPaise
                      ? t('money:pay.payUpi', { amount: money(params.amountPaise) })
                      : t('money:pay.payUpiNoAmount')
                  }
                  onPress={() => void openUpi(i)}
                />
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
