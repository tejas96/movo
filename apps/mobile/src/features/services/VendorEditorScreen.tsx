import { E164_PHONE } from '@movo/contracts';
import {
  BottomBar,
  Button,
  Input,
  OptionSheet,
  Screen,
  Segmented,
  SelectField,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { formatPhone, normalizePhone } from '../../core/util/phone';
import { useSaveVendor, useVendor, useVendorCategories } from './api';
import { categoryLabel } from './shared';

type EditableStatus = 'APPROVED' | 'TRIAL' | 'BLOCKED';

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

  const [categoryId, setCategoryId] = useState(params?.categoryId ?? '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [availability, setAvailability] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<EditableStatus>('APPROVED');
  const [adminNotes, setAdminNotes] = useState('');
  const [pickCategory, setPickCategory] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const v = existing.data;
    if (!vendorId || !v) return;
    setCategoryId(v.category.id);
    setName(v.name);
    setPhone(formatPhone(v.phone));
    setAltPhone(v.altPhone ? formatPhone(v.altPhone) : '');
    setAvailability(v.availability ?? '');
    setDescription(v.description ?? '');
    setStatus(v.status === 'SUGGESTED' ? 'APPROVED' : v.status);
    setAdminNotes(v.adminNotes ?? '');
  }, [vendorId, existing.data]);

  const category = categories.data?.find((c) => c.id === categoryId);

  const submit = async () => {
    setFormError(null);
    const next: Record<string, string> = {};
    const e164 = normalizePhone(phone);
    const alt = altPhone.trim() ? normalizePhone(altPhone) : null;
    if (!categoryId) next.category = t('common:validation.required');
    if (name.trim().length < 2) next.name = t('common:validation.required');
    if (!E164_PHONE.test(e164)) next.phone = t('common:validation.invalidIdentifier');
    if (alt && !E164_PHONE.test(alt)) next.altPhone = t('common:validation.invalidIdentifier');
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await save.mutateAsync({
        categoryId,
        name: name.trim(),
        phone: e164,
        altPhone: alt,
        availability: availability.trim() || null,
        description: description.trim() || null,
        ...(canManage ? { status, adminNotes: adminNotes.trim() || null } : {}),
      });
      toast.show(canManage ? t('services:saved') : t('services:suggested'));
      nav.goBack();
    } catch (e) {
      setFormError(toMessage(e));
    }
  };

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
        <View className="mt-6 gap-3">
          <SelectField
            label={t('services:form.category')}
            value={category ? categoryLabel(category) : undefined}
            error={errors.category}
            onPress={() => setPickCategory(true)}
          />
          <Input
            label={t('services:form.name')}
            value={name}
            onChangeText={setName}
            error={errors.name}
            maxLength={60}
          />
          <Input
            label={t('services:form.phone')}
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
            keyboardType="phone-pad"
            icon="call"
          />
          <Input
            label={t('services:form.altPhone')}
            value={altPhone}
            onChangeText={setAltPhone}
            error={errors.altPhone}
            keyboardType="phone-pad"
          />
          <Input
            label={t('services:form.availability')}
            helper={t('services:form.availabilityHelp')}
            value={availability}
            onChangeText={setAvailability}
            maxLength={100}
          />
          <Input
            label={t('services:form.description')}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={500}
            style={{ minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }}
          />
          {canManage ? (
            <>
              <View>
                <Text variant="label" tone="secondary" className="mb-1.5">
                  {t('services:form.status')}
                </Text>
                <Segmented
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'APPROVED', label: t('services:status.APPROVED') },
                    { value: 'TRIAL', label: t('services:status.TRIAL') },
                    { value: 'BLOCKED', label: t('services:status.BLOCKED') },
                  ]}
                />
              </View>
              <Input
                label={t('services:form.adminNotes')}
                value={adminNotes}
                onChangeText={setAdminNotes}
                multiline
                maxLength={500}
                style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 12 }}
              />
            </>
          ) : null}
          {formError ? (
            <Text variant="caption" tone="danger">
              {formError}
            </Text>
          ) : null}
        </View>
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
        onSelect={setCategoryId}
      />
    </>
  );
}
