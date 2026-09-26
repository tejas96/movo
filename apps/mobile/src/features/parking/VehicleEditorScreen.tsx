import { normalizeRegistration, type VehicleType, VehicleTypeSchema } from '@movo/contracts';
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
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatFlat, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { useDeleteVehicle, useSaveVehicle } from './api';
import { formatRegistration } from './shared';

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

  const [flatId, setFlatId] = useState(
    vehicle?.flat.id ?? params?.flatId ?? tenant.flats[0]?.id ?? '',
  );
  const [registration, setRegistration] = useState(
    vehicle ? formatRegistration(vehicle.registrationNo) : '',
  );
  const [type, setType] = useState<VehicleType>(vehicle?.type ?? 'FOUR_WHEELER');
  const [makeModel, setMakeModel] = useState(vehicle?.makeModel ?? '');
  const [color, setColor] = useState(vehicle?.color ?? '');
  const [sheet, setSheet] = useState<'flat' | 'type' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flatOptions = tenant.flats.map((f) => ({ value: f.id, label: formatFlat(f) }));
  const flatLabel = vehicle
    ? formatFlat(vehicle.flat)
    : flatOptions.find((f) => f.value === flatId)?.label;

  const submit = async () => {
    setError(null);
    const reg = normalizeRegistration(registration);
    if (reg.length < 4 || reg.length > 15 || !flatId) {
      setError(t('common:validation.required'));
      return;
    }
    try {
      await save.mutateAsync({
        flatId,
        registrationNo: reg,
        type,
        makeModel: makeModel.trim() || null,
        color: color.trim() || null,
      });
      toast.show(t('parking:vehicleSaved'));
      nav.goBack();
    } catch (e) {
      setError(toMessage(e));
    }
  };

  const del = async () => {
    if (!vehicle) return;
    try {
      await remove.mutateAsync(vehicle.id);
      toast.show(t('parking:vehicleRemoved'));
      nav.goBack();
    } catch (e) {
      setError(toMessage(e));
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
          <Input
            label={t('parking:form.registrationNo')}
            helper={t('parking:form.registrationHelp')}
            value={registration}
            onChangeText={setRegistration}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
          />
          <SelectField
            label={t('parking:form.type')}
            value={t(`parking:vehicleType.${type}`)}
            onPress={() => setSheet('type')}
          />
          <Input
            label={t('parking:form.makeModel')}
            value={makeModel}
            onChangeText={setMakeModel}
            maxLength={40}
          />
          <Input
            label={t('parking:form.color')}
            value={color}
            onChangeText={setColor}
            maxLength={20}
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
        onSelect={setFlatId}
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
        onSelect={setType}
      />
    </>
  );
}
