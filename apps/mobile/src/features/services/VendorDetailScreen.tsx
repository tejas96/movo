import type { VendorStatus } from '@movo/contracts';
import {
  BottomBar,
  Button,
  Card,
  CircleButton,
  IconSquare,
  Row,
  Screen,
  Skeleton,
  StatusPill,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { formatPhone } from '../../core/util/phone';
import { useDeleteVendor, useUpdateVendor, useVendor, useVendorCategories } from './api';
import { CATEGORY_ICON, categoryLabel, STATUS_TONE } from './shared';

export function VendorDetailScreen() {
  const { t } = useTranslation(['services', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const { vendorId } = useRoute<RouteProp<RootStackParamList, 'VendorDetail'>>().params;
  const vendor = useVendor(societyId, vendorId);
  const categories = useVendorCategories(societyId);
  const update = useUpdateVendor(societyId, vendorId);
  const remove = useDeleteVendor(societyId, vendorId);
  const canManage = useCan('vendor.manage');
  const v = vendor.data;
  const icon = categories.data?.find((c) => c.id === v?.category.id)?.icon ?? 'services';

  const setStatus = async (status: Exclude<VendorStatus, 'SUGGESTED'>) => {
    try {
      await update.mutateAsync({ status });
      toast.show(t('services:saved'));
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };
  const del = async () => {
    try {
      await remove.mutateAsync();
      toast.show(t('services:deleted'));
      nav.goBack();
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };
  const call = (phone: string) => void Linking.openURL(`tel:${phone}`);

  return (
    <>
      <Screen bottomBar={Boolean(v && v.status !== 'BLOCKED')}>
        <TitleBar
          title={v ? categoryLabel(v.category) : t('services:title')}
          onBack={() => nav.goBack()}
          trailing={
            canManage && v ? (
              <IconSquare
                icon="edit"
                variant="linear"
                accessibilityLabel={t('common:actions.edit')}
                onPress={() => nav.navigate('VendorEditor', { vendorId })}
              />
            ) : undefined
          }
        />
        {!v ? (
          <View className="mt-6 gap-3">
            <Skeleton className="h-16 w-16 self-center" />
            <Skeleton className="h-40 rounded-xl" />
          </View>
        ) : (
          <>
            <View className="mt-6 items-center">
              <IconSquare icon={CATEGORY_ICON[icon]} />
              <Text variant="h2" center className="mt-3">
                {v.name}
              </Text>
              {v.status !== 'APPROVED' ? (
                <StatusPill
                  label={t(`services:status.${v.status}`)}
                  tone={STATUS_TONE[v.status]}
                  className="mt-2 self-center"
                />
              ) : null}
            </View>
            <Card tight className="mt-6 gap-2">
              <Row
                icon="call"
                title={formatPhone(v.phone)}
                trailing={
                  <CircleButton
                    icon="call"
                    accessibilityLabel={t('services:detail.call')}
                    onPress={() => call(v.phone)}
                  />
                }
              />
              {v.altPhone ? (
                <Row
                  icon="callCalling"
                  title={formatPhone(v.altPhone)}
                  trailing={
                    <CircleButton
                      icon="call"
                      variant="linear"
                      tone="gray"
                      accessibilityLabel={t('services:detail.altCall')}
                      onPress={() => call(v.altPhone ?? '')}
                    />
                  }
                />
              ) : null}
              {v.availability ? (
                <Row
                  icon="clock"
                  title={v.availability}
                  subtitle={t('services:detail.availability')}
                />
              ) : null}
              {v.description ? (
                <Row icon="info" title={v.description} subtitle={t('services:detail.about')} />
              ) : null}
              {v.adminNotes ? (
                <Row icon="shield" title={v.adminNotes} subtitle={t('services:detail.notes')} />
              ) : null}
            </Card>
            <Text variant="label" tone="secondary" center className="mt-3">
              {t('services:detail.addedBy', { name: v.addedBy.displayName })}
            </Text>

            {canManage ? (
              <View className="mt-6 gap-3">
                {v.status === 'SUGGESTED' ? (
                  <Button
                    label={t('services:detail.approve')}
                    icon="check"
                    onPress={() => void setStatus('APPROVED')}
                    loading={update.isPending}
                  />
                ) : null}
                {v.status === 'BLOCKED' ? (
                  <Button
                    label={t('services:detail.unblock')}
                    variant="gray"
                    onPress={() => void setStatus('APPROVED')}
                    loading={update.isPending}
                  />
                ) : v.status !== 'SUGGESTED' ? (
                  <Button
                    label={t('services:detail.block')}
                    variant="gray"
                    onPress={() => void setStatus('BLOCKED')}
                    loading={update.isPending}
                  />
                ) : null}
                {v.status === 'SUGGESTED' || v.status === 'BLOCKED' ? (
                  <Button
                    label={t('common:actions.delete')}
                    variant="danger"
                    onPress={() => void del()}
                    loading={remove.isPending}
                  />
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </Screen>
      {v && v.status !== 'BLOCKED' ? (
        <BottomBar
          label={t(`services:status.${v.status}`)}
          value={v.name}
          action={
            <Button
              label={t('services:detail.call')}
              icon="call"
              inline
              onPress={() => call(v.phone)}
            />
          }
        />
      ) : null}
    </>
  );
}
