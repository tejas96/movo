import type { MyParking } from '@movo/contracts';
import {
  Button,
  Card,
  EmptyState,
  IconSquare,
  ModuleHeader,
  photos,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
} from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useCan, useSocietyId } from '../../core/tenant/hooks';
import { mediumDate } from '../../core/util/time';
import { useMyParking } from './api';
import { formatRegistration, slotIcon } from './shared';

export function ParkingScreen() {
  const { t } = useTranslation(['parking', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const canManage = useCan('parking.manage');
  const mine = useMyParking(societyId);
  const data = mine.data;

  return (
    <Screen refreshing={mine.isRefetching} onRefresh={() => void mine.refetch()}>
      <ModuleHeader
        source={photos.parking}
        title={t('parking:title')}
        onBack={() => nav.goBack()}
        trailing={
          canManage || data?.canSeeAll ? (
            <IconSquare
              icon={canManage ? 'settings' : 'parking'}
              variant="linear"
              accessibilityLabel={t('parking:slots.title')}
              onPress={() => nav.navigate('ParkingSlots')}
            />
          ) : undefined
        }
      />
      {mine.isLoading ? (
        <View className="mt-6 gap-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </View>
      ) : !data || data.flats.length === 0 ? (
        <EmptyState
          photo={photos.empty}
          icon="parking"
          title={t('parking:noFlat')}
          className="mt-10"
        />
      ) : (
        data.flats.map((f) => (
          <FlatParking key={f.flat.id} entry={f} showFlat={data.flats.length > 1} />
        ))
      )}
    </Screen>
  );
}

function FlatParking({
  entry,
  showFlat,
}: {
  entry: MyParking['flats'][number];
  showFlat: boolean;
}) {
  const { t } = useTranslation(['parking', 'common']);
  const nav = useNav();
  const flat = formatFlat(entry.flat);
  return (
    <View>
      {showFlat ? (
        <Text variant="h3" className="mt-6">
          {flat}
        </Text>
      ) : null}
      <SectionHeader title={t('parking:mySlots')} className={showFlat ? 'mt-3' : undefined} />
      {entry.slots.length === 0 ? (
        <Card className="flex-row items-center gap-4">
          <IconSquare icon="parking" tone="white" />
          <View className="flex-1">
            <Text variant="title">{t('parking:noSlot')}</Text>
            <Text variant="label" tone="secondary">
              {t('parking:noSlotBody')}
            </Text>
          </View>
        </Card>
      ) : (
        <Card tight className="gap-2">
          {entry.slots.map((s) => (
            <Row
              key={s.id}
              icon={slotIcon(s.type)}
              title={s.code}
              subtitle={[
                t(`parking:slotType.${s.type}`),
                s.level ? t('parking:level', { level: s.level }) : null,
                s.allocation
                  ? t('parking:since', { date: mediumDate(s.allocation.fromDate) })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
        </Card>
      )}

      <SectionHeader title={t('parking:myVehicles')} />
      <Card tight className="gap-2">
        {entry.vehicles.length === 0 ? (
          <Text variant="label" tone="secondary" className="px-3 py-4">
            {t('parking:noVehicles')}
          </Text>
        ) : (
          entry.vehicles.map((v) => (
            <Row
              key={v.id}
              icon={slotIcon(v.type)}
              title={formatRegistration(v.registrationNo)}
              subtitle={[t(`parking:vehicleType.${v.type}`), v.makeModel, v.color]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => nav.navigate('VehicleEditor', { vehicle: v })}
            />
          ))
        )}
      </Card>
      <Button
        label={t('parking:addVehicle')}
        icon="add"
        variant="gray"
        className="mt-3"
        onPress={() => nav.navigate('VehicleEditor', { flatId: entry.flat.id })}
      />
    </View>
  );
}
