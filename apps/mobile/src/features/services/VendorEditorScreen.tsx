import { type Vendor, vendorsContract } from '@movo/contracts';
import {
  BottomBar,
  Button,
  Card,
  Input,
  OptionSheet,
  Screen,
  Segmented,
  SelectField,
  Text,
  TextArea,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { bodyResolver, usePrefill } from '../../core/forms/contract-form';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { formatPhone, normalizePhone } from '../../core/util/phone';
import { useSaveVendor, useVendor, useVendorCategories } from './api';
import { categoryLabel } from './shared';

type EditableStatus = 'APPROVED' | 'TRIAL' | 'BLOCKED';

interface VendorForm {
  categoryId: string;
  name: string;
  phone: string;
  altPhone: string;
  availability: string;
  description: string;
  status: EditableStatus;
  adminNotes: string;
}

const empty = (categoryId: string): VendorForm => ({
  categoryId,
  name: '',
  phone: '',
  altPhone: '',
  availability: '',
  description: '',
  status: 'APPROVED',
  adminNotes: '',
});

function toForm(v: Vendor): VendorForm {
  return {
    categoryId: v.category.id,
    name: v.name,
    phone: formatPhone(v.phone),
    altPhone: v.altPhone ? formatPhone(v.altPhone) : '',
    availability: v.availability ?? '',
    description: v.description ?? '',
    status: v.status === 'SUGGESTED' ? 'APPROVED' : v.status,
    adminNotes: v.adminNotes ?? '',
  };
}

function toBody(v: VendorForm, canManage: boolean) {
  return {
    categoryId: v.categoryId,
    name: v.name.trim(),
    phone: normalizePhone(v.phone),
    altPhone: v.altPhone.trim() ? normalizePhone(v.altPhone) : null,
    availability: v.availability.trim() || null,
    description: v.description.trim() || null,
    ...(canManage ? { status: v.status, adminNotes: v.adminNotes.trim() || null } : {}),
  };
}

export function VendorEditorScreen() {
  const { t } = useTranslation(['services', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const params = useRoute<RouteProp<RootStackParamList, 'VendorEditor'>>().params;
  const vendorId = params?.vendorId;
  const canManage = useCan('vendor.manage');
  const categories = useVendorCategories(societyId);
  const existing = useVendor(societyId, vendorId ?? '');
  const save = useSaveVendor(societyId, vendorId);
  const [pickCategory, setPickCategory] = useState(false);

  const body = (v: VendorForm) => toBody(v, canManage);
  const form = useForm<VendorForm>({
    resolver: bodyResolver(vendorsContract.create.body, body),
    defaultValues: empty(params?.categoryId ?? ''),
    reValidateMode: 'onSubmit',
  });
  usePrefill(form, vendorId ? existing.data : undefined, toForm);
  const { errors } = form.formState;
  const required = t('common:validation.required');
  const badPhone = t('common:validation.invalidIdentifier');
  const formError = errors.root?.server?.message;
  const { categoryId, status } = form.watch();

  const category = categories.data?.find((c) => c.id === categoryId);

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(body(values));
      toast.show(canManage ? t('services:saved') : t('services:suggested'));
      nav.goBack();
    } catch (e) {
      form.setError('root.server', { message: toMessage(e) });
    }
  });

  const failed =
    vendorId && loadFailed(existing) ? existing : loadFailed(categories) ? categories : null;
  if (failed)
    return (
      <Screen>
        <TitleBar
          title={vendorId ? t('common:actions.edit') : t('services:add')}
          onBack={() => nav.goBack()}
        />
        <QueryError query={failed} className="mt-10" />
      </Screen>
    );

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={
            vendorId
              ? t('common:actions.edit')
              : canManage
                ? t('services:add')
                : t('services:suggest')
          }
          onBack={() => nav.goBack()}
        />
        {!canManage ? (
          <Text variant="label" tone="secondary" className="mt-4">
            {t('services:suggestHelp')}
          </Text>
        ) : null}
        <Card className="mt-6 gap-3">
          <SelectField
            label={t('services:form.category')}
            value={category ? categoryLabel(category) : undefined}
            error={errors.categoryId ? required : undefined}
            onPress={() => setPickCategory(true)}
          />
          <Controller
            control={form.control}
            name="name"
            render={({ field }) => (
              <Input
                label={t('services:form.name')}
                value={field.value}
                onChangeText={field.onChange}
                error={errors.name ? required : undefined}
                maxLength={60}
              />
            )}
          />
          <Controller
            control={form.control}
            name="phone"
            render={({ field }) => (
              <Input
                label={t('services:form.phone')}
                value={field.value}
                onChangeText={field.onChange}
                error={errors.phone ? badPhone : undefined}
                keyboardType="phone-pad"
                icon="call"
              />
            )}
          />
          <Controller
            control={form.control}
            name="altPhone"
            render={({ field }) => (
              <Input
                label={t('services:form.altPhone')}
                value={field.value}
                onChangeText={field.onChange}
                error={errors.altPhone ? badPhone : undefined}
                keyboardType="phone-pad"
              />
            )}
          />
          <Controller
            control={form.control}
            name="availability"
            render={({ field }) => (
              <Input
                label={t('services:form.availability')}
                helper={t('services:form.availabilityHelp')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={100}
              />
            )}
          />
          <Controller
            control={form.control}
            name="description"
            render={({ field }) => (
              <TextArea
                label={t('services:form.description')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={500}
              />
            )}
          />
          {canManage ? (
            <>
              <View>
                <Text variant="caption" className="mb-1.5 pl-1.5 font-medium">
                  {t('services:form.status')}
                </Text>
                <Segmented
                  value={status}
                  onChange={(v) => form.setValue('status', v)}
                  options={[
                    { value: 'APPROVED', label: t('services:status.APPROVED') },
                    { value: 'TRIAL', label: t('services:status.TRIAL') },
                    { value: 'BLOCKED', label: t('services:status.BLOCKED') },
                  ]}
                />
              </View>
              <Controller
                control={form.control}
                name="adminNotes"
                render={({ field }) => (
                  <TextArea
                    label={t('services:form.adminNotes')}
                    value={field.value}
                    onChangeText={field.onChange}
                    maxLength={500}
                    minHeight={80}
                  />
                )}
              />
            </>
          ) : null}
          {formError ? (
            <Text variant="caption" tone="danger">
              {formError}
            </Text>
          ) : null}
        </Card>
      </Screen>
      <BottomBar
        action={
          <Button
            label={canManage || vendorId ? t('common:actions.save') : t('services:suggest')}
            inline
            onPress={() => void submit()}
            loading={save.isPending}
          />
        }
      />
      <OptionSheet
        visible={pickCategory}
        onClose={() => setPickCategory(false)}
        title={t('services:form.category')}
        options={(categories.data ?? []).map((c) => ({ value: c.id, label: categoryLabel(c) }))}
        value={categoryId || undefined}
        onSelect={(id) => form.setValue('categoryId', id)}
      />
    </>
  );
}
