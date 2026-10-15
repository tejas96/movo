import {
  normalizeRegistration,
  parkingContract,
  type VehicleType,
  VehicleTypeSchema,
} from '@movo/contracts';
import {
  BottomBar,
  Button,
  Input,
  OptionSheet,
  Screen,
  SelectField,
  Text,
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
import { bodyResolver, formMessage } from '../../core/forms/contract-form';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatRegistration } from '../../core/parking/shared';
import { formatFlat, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { useDeleteVehicle, useSaveVehicle } from './api';

interface VehicleForm {
  flatId: string;
  registration: string;
  type: VehicleType;
  makeModel: string;
  color: string;
}

function toBody(v: VehicleForm) {
  return {
    flatId: v.flatId,
    registrationNo: normalizeRegistration(v.registration),
    type: v.type,
    makeModel: v.makeModel.trim() || null,
    color: v.color.trim() || null,
  };
}

export function VehicleEditorScreen() {
  const { t } = useTranslation(['parking', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const params = useRoute<RouteProp<RootStackParamList, 'VehicleEditor'>>().params;
  const vehicle = params?.vehicle;
  const save = useSaveVehicle(societyId, vehicle?.id);
  const remove = useDeleteVehicle(societyId);

  // The vehicle comes with the route, so the form starts from it (no load, no pre-fill).
  const form = useForm<VehicleForm>({
    resolver: bodyResolver(parkingContract.createVehicle.body, toBody),
    defaultValues: {
      flatId: vehicle?.flat.id ?? params?.flatId ?? tenant.flats[0]?.id ?? '',
      registration: vehicle ? formatRegistration(vehicle.registrationNo) : '',
      type: vehicle?.type ?? 'FOUR_WHEELER',
      makeModel: vehicle?.makeModel ?? '',
      color: vehicle?.color ?? '',
    },
    reValidateMode: 'onSubmit',
  });
  const error = formMessage(form, t('common:validation.required'));
  const { flatId, type } = form.watch();
  const [sheet, setSheet] = useState<'flat' | 'type' | null>(null);

  const flatOptions = tenant.flats.map((f) => ({ value: f.id, label: formatFlat(f) }));
  const flatLabel = vehicle
    ? formatFlat(vehicle.flat)
    : flatOptions.find((f) => f.value === flatId)?.label;

  const submit = form.handleSubmit(async (values) => {
    try {
      await save.mutateAsync(toBody(values));
      toast.show(t('parking:vehicleSaved'));
      nav.goBack();
    } catch (e) {
      form.setError('root.server', { message: toMessage(e) });
    }
  });

  const del = async () => {
    if (!vehicle) return;
    try {
      await remove.mutateAsync(vehicle.id);
      toast.show(t('parking:vehicleRemoved'));
      nav.goBack();
    } catch (e) {
      form.setError('root.server', { message: toMessage(e) });
    }
  };

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={vehicle ? t('parking:editVehicle') : t('parking:addVehicle')}
          onBack={() => nav.goBack()}
        />
        <View className="mt-6 gap-3">
          <SelectField
            label={t('parking:form.flat')}
            value={flatLabel}
            onPress={() => (!vehicle && flatOptions.length > 1 ? setSheet('flat') : undefined)}
          />
          <Controller
            control={form.control}
            name="registration"
            render={({ field }) => (
              <Input
                label={t('parking:form.registrationNo')}
                helper={t('parking:form.registrationHelp')}
                value={field.value}
                onChangeText={field.onChange}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
              />
            )}
          />
          <SelectField
            label={t('parking:form.type')}
            value={t(`parking:vehicleType.${type}`)}
            onPress={() => setSheet('type')}
          />
          <Controller
            control={form.control}
            name="makeModel"
            render={({ field }) => (
              <Input
                label={t('parking:form.makeModel')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={40}
              />
            )}
          />
          <Controller
            control={form.control}
            name="color"
            render={({ field }) => (
              <Input
                label={t('parking:form.color')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={20}
              />
            )}
          />
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
          {vehicle ? (
            <Button
              label={t('parking:removeVehicle')}
              variant="ghost"
              icon="trash"
              onPress={() => void del()}
              loading={remove.isPending}
              className="mt-4"
            />
          ) : null}
        </View>
      </Screen>
      <BottomBar
        action={
          <Button
            label={t('common:actions.save')}
            inline
            onPress={() => void submit()}
            loading={save.isPending}
          />
        }
      />
      <OptionSheet
        visible={sheet === 'flat'}
        onClose={() => setSheet(null)}
        title={t('parking:form.flat')}
        options={flatOptions}
        value={flatId}
        onSelect={(id) => form.setValue('flatId', id)}
      />
      <OptionSheet
        visible={sheet === 'type'}
        onClose={() => setSheet(null)}
        title={t('parking:form.type')}
        options={VehicleTypeSchema.options.map((v) => ({
          value: v,
          label: t(`parking:vehicleType.${v}`),
        }))}
        value={type}
        onSelect={(v) => form.setValue('type', v)}
      />
    </>
  );
}
