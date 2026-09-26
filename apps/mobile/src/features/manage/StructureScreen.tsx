import {
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  OptionSheet,
  Pill,
  photos,
  Row,
  Screen,
  SelectField,
  Sheet,
  Skeleton,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { useBuildings, useCreateBuilding, useCreateFlats, useFlats } from './api';

const NO_BUILDING = '__none__';

export function StructureScreen() {
  const { t } = useTranslation(['manage', 'common', 'onboarding']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const buildings = useBuildings(societyId);
  const flats = useFlats(societyId);
  const createBuilding = useCreateBuilding(societyId);
  const createFlats = useCreateFlats(societyId);
  const [filter, setFilter] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'building' | 'flats' | null>(null);
  const [buildingName, setBuildingName] = useState('');
  const [flatBuilding, setFlatBuilding] = useState<string>(NO_BUILDING);
  const [flatNumbers, setFlatNumbers] = useState('');
  const [pickBuilding, setPickBuilding] = useState(false);

  const visible = useMemo(
    () => (flats.data ?? []).filter((f) => (filter ? f.buildingId === filter : true)),
    [flats.data, filter],
  );
  const buildingOptions = [
    { value: NO_BUILDING, label: t('manage:invite.noFlat') },
    ...(buildings.data ?? []).map((b) => ({ value: b.id, label: b.name })),
  ];

  const addBuilding = async () => {
    if (!buildingName.trim()) return;
    try {
      await createBuilding.mutateAsync({ name: buildingName.trim() });
      setBuildingName('');
      setSheet(null);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };
  const addFlats = async () => {
    const numbers = [
      ...new Set(
        flatNumbers
          .split(/[,\n;]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    if (numbers.length === 0) return;
    try {
      const created = await createFlats.mutateAsync({
        flats: numbers.map((number) => ({
          number,
          buildingId: flatBuilding === NO_BUILDING ? null : flatBuilding,
          floor: /^\d{3,}$/.test(number) ? Number(number.slice(0, -2)) : null,
        })),
      });
      toast.show(t('manage:structureForm.added', { count: created.length }));
      setFlatNumbers('');
      setSheet(null);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen refreshing={flats.isRefetching} onRefresh={() => void flats.refetch()}>
      <TitleBar title={t('manage:structure')} onBack={() => nav.goBack()} />
      <View className="mt-6 flex-row gap-2">
        <Button
          label={t('manage:structureForm.addBuilding')}
          variant="gray"
          size="sm"
          inline
          icon="add"
          onPress={() => setSheet('building')}
          className="flex-1"
        />
        <Button
          label={t('manage:structureForm.addFlats')}
          size="sm"
          inline
          icon="add"
          onPress={() => setSheet('flats')}
          className="flex-1"
        />
      </View>
      {buildings.data && buildings.data.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-4 -mx-5"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          <Chip
            label={t('common:actions.seeAll')}
            selected={filter === null}
            onPress={() => setFilter(null)}
            className="h-11"
          />
          {buildings.data.map((b) => (
            <Chip
              key={b.id}
              label={`${b.name} · ${b.flatCount}`}
              selected={filter === b.id}
              onPress={() => setFilter(b.id)}
              className="h-11"
            />
          ))}
        </ScrollView>
      ) : null}
      {flats.isLoading ? (
        <Skeleton className="mt-4 h-40 rounded-xl" />
      ) : visible.length === 0 ? (
        <EmptyState
          photo={photos.empty}
          icon="building"
          title={t('manage:structureForm.empty')}
          body={t('manage:structureForm.emptyBody')}
          className="mt-10"
        />
      ) : (
        <Card tight className="mt-4 gap-2">
          {visible.map((f) => (
            <Row
              key={f.id}
              icon="flat"
              title={f.buildingName ? `${f.buildingName}-${f.number}` : f.number}
              subtitle={f.occupants.map((o) => o.displayName).join(', ') || undefined}
              trailing={
                <Pill
                  label={t(`common:status.${f.status === 'OCCUPIED' ? 'ACTIVE' : 'PENDING'}`)}
                  tone="gray"
                  size="sm"
                />
              }
            />
          ))}
        </Card>
      )}

      <Sheet
        visible={sheet === 'building'}
        onClose={() => setSheet(null)}
        title={t('manage:structureForm.addBuilding')}
        footer={
          <Button
            label={t('common:actions.save')}
            onPress={() => void addBuilding()}
            loading={createBuilding.isPending}
          />
        }
      >
        <Input
          white
          label={t('manage:structureForm.buildingName')}
          value={buildingName}
          onChangeText={setBuildingName}
          autoFocus
        />
      </Sheet>
      <Sheet
        visible={sheet === 'flats'}
        onClose={() => setSheet(null)}
        title={t('manage:structureForm.addFlats')}
        footer={
          <Button
            label={t('common:actions.save')}
            onPress={() => void addFlats()}
            loading={createFlats.isPending}
          />
        }
      >
        <View className="gap-3">
          <SelectField
            white
            label={t('onboarding:building')}
            value={buildingOptions.find((o) => o.value === flatBuilding)?.label}
            onPress={() => setPickBuilding(true)}
          />
          <Input
            white
            label={t('manage:structureForm.flatNumbers')}
            helper={t('manage:structureForm.flatNumbersHelp')}
            value={flatNumbers}
            onChangeText={setFlatNumbers}
            multiline
            style={{ minHeight: 96, textAlignVertical: 'top' }}
          />
          <Text variant="micro" tone="secondary" className="font-normal">
            {t('manage:structureForm.flatNumbersHelp')}
          </Text>
        </View>
      </Sheet>
      <OptionSheet
        visible={pickBuilding}
        onClose={() => setPickBuilding(false)}
        options={buildingOptions}
        value={flatBuilding}
        onSelect={setFlatBuilding}
      />
    </Screen>
  );
}
