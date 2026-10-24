import type { VendorStatus } from '@movo/contracts';
import {
  BottomBar,
  Button,
  Card,
  CircleButton,
  IconSquare,
  Rise,
  Row,
  Screen,
  Skeleton,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Linking, View } from 'react-native';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { CATEGORY_ICON } from '../../core/ui/category-icon';
import { DetailHero, HeroPill } from '../../core/ui/DetailHero';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { StatusPill } from '../../core/ui/StatusPill';
import { formatPhone } from '../../core/util/phone';
import { useDeleteVendor, useUpdateVendor, useVendor, useVendorCategories } from './api';
import { categoryLabel, STATUS_TONE } from './shared';

export function VendorDetailScreen() {
  const { t } = useTranslation(['services', 'common']);
  const nav = useNav();
  const toast = useToast();
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const { vendorId } = useRoute<RouteProp<RootStackParamList, 'VendorDetail'>>().params;
  const vendor = useVendor(societyId, vendorId);
  const categories = useVendorCategories(societyId);
  const update = useUpdateVendor(societyId, vendorId);
  const remove = useDeleteVendor(societyId, vendorId);
  const v = vendor.data;
  const icon = categories.data?.find((c) => c.id === v?.category.id)?.icon ?? 'services';

  const setStatus = async (status: Exclude<VendorStatus, 'SUGGESTED'>) => {
    await withErrorToast(async () => {
      await update.mutateAsync({ status });
      toast.show(t('services:saved'));
    });
  };
  const del = async () => {
    await withErrorToast(async () => {
      await remove.mutateAsync();
      toast.show(t('services:deleted'));
      nav.goBack();
    });
  };
  const call = (phone: string) => void Linking.openURL(`tel:${phone}`);

  return (
    <>
      <Screen bottomBar={Boolean(v && v.status !== 'BLOCKED')}>
        {loadFailed(vendor) ? (
          <>
            <TitleBar title={t('services:title')} onBack={() => nav.goBack()} />
            <QueryError query={vendor} className="mt-6" />
          </>
        ) : !v ? (
          <View className="gap-3">
            <Skeleton className="h-[300px] rounded-[40px]" />
            <Skeleton className="h-40 rounded-xl" />
          </View>
        ) : (
          <>
            <Rise>
              <DetailHero
                art="sand"
                onBack={() => nav.goBack()}
                trailing={
                  v.canManage ? (
                    <IconSquare
                      icon="edit"
                      variant="linear"
                      diameter={46}
                      accessibilityLabel={t('common:actions.edit')}
                      onPress={() => nav.navigate('VendorEditor', { vendorId })}
                    />
                  ) : undefined
                }
                icon={{ name: CATEGORY_ICON[icon], motion: 'wobble' }}
                pills={
                  <>
                    <HeroPill label={categoryLabel(v.category)} />
                    {v.status !== 'APPROVED' ? (
                      <StatusPill value={v.status} tones={STATUS_TONE} labels="services:status" />
                    ) : null}
                  </>
                }
                title={v.name}
              />
            </Rise>
            <Card tight className="mt-4 gap-2">
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

            {v.canManage ? (
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
