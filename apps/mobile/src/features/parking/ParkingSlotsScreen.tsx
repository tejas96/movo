import { type ParkingSlot, type ParkingSlotType, ParkingSlotTypeSchema } from '@movo/contracts';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  IconSquare,
  Input,
  Row,
  Screen,
  Segmented,
  Sheet,
  Skeleton,
  StatusPill,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useCan, useSocietyId } from '../../core/tenant/hooks';
import { useFlats } from '../manage/api';
import { type SlotFilter, useCreateSlots, useParkingSlots, useSlotAction } from './api';
import { slotIcon } from './shared';

const MAX_SLOTS = 500;

/** "P-", 1, 20 -> P-01 … P-20. Pads to the width of the last number. */
function slotCodes(prefix: string, from: number, to: number): string[] {
  const width = String(to).length;
  const codes: string[] = [];
  for (let n = from; n <= to && codes.length < MAX_SLOTS; n++)
    codes.push(`${prefix.trim().toUpperCase()}${String(n).padStart(width, '0')}`);
  return codes;
}

export function ParkingSlotsScreen() {
  const { t } = useTranslation(['parking', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const canManage = useCan('parking.manage');
  const [filter, setFilter] = useState<SlotFilter>('all');
  const slots = useParkingSlots(societyId, filter);
  const all = useParkingSlots(societyId, 'all');
  const flats = useFlats(societyId);
  const action = useSlotAction(societyId);
  const create = useCreateSlots(societyId);

  const [selected, setSelected] = useState<ParkingSlot | null>(null);
  const [pickFlat, setPickFlat] = useState(false);
  const [adding, setAdding] = useState(false);
  const [prefix, setPrefix] = useState('P-');
  const [from, setFrom] = useState('1');
  const [to, setTo] = useState('10');
  const [type, setType] = useState<ParkingSlotType>('FOUR_WHEELER');
  const [level, setLevel] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const total = all.data?.length ?? 0;
  const taken = all.data?.filter((s) => s.allocation).length ?? 0;
  const codes = useMemo(() => {
    const a = Number.parseInt(from, 10);
    const b = Number.parseInt(to, 10);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < a) return [];
    return slotCodes(prefix, a, b);
  }, [prefix, from, to]);

  const flatOptions = (flats.data ?? [])
    .slice()
    .sort(
      (x, y) =>
        (x.buildingName ?? '').localeCompare(y.buildingName ?? '') ||
        x.number.localeCompare(y.number, 'en', { numeric: true }),
    )
    .map((f) => ({ value: f.id, label: formatFlat(f) }));

  const run = async (
    input: Parameters<typeof action.mutateAsync>[0],
    success: string,
  ): Promise<void> => {
    try {
      await action.mutateAsync(input);
      toast.show(success);
      setSelected(null);
      setPickFlat(false);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  const addSlots = async () => {
    setAddError(null);
    if (codes.length === 0) {
      setAddError(t('common:validation.required'));
      return;
    }
    try {
      const created = await create.mutateAsync({
        slots: codes.map((code) => ({ code, type, level: level.trim() || null })),
      });
      toast.show(t('parking:slots.added', { count: created.length }));
      setAdding(false);
    } catch (e) {
      setAddError(toMessage(e));
    }
  };

  const subtitle = (s: ParkingSlot) =>
    [
      t(`parking:slotType.${s.type}`),
      s.level ? t('parking:level', { level: s.level }) : null,
      s.allocation?.notes ?? null,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <Screen scroll={false}>
      <TitleBar
        title={t('parking:slots.title')}
        onBack={() => nav.goBack()}
        trailing={
          canManage ? (
            <IconSquare
              icon="add"
              variant="linear"
              accessibilityLabel={t('parking:slots.add')}
              onPress={() => {
                setAddError(null);
                setAdding(true);
              }}
            />
          ) : undefined
        }
      />
      {total > 0 ? (
        <Text variant="label" tone="secondary" center className="mt-2">
          {t('parking:slots.summary', { taken, total })}
        </Text>
      ) : null}
      <Segmented
        className="mt-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('parking:filter.all') },
          { value: 'free', label: t('parking:filter.free') },
          { value: 'taken', label: t('parking:filter.taken') },
        ]}
      />
      {slots.isLoading ? (
        <View className="mt-4 gap-3">
          <Skeleton className="h-[68px]" />
          <Skeleton className="h-[68px]" />
          <Skeleton className="h-[68px]" />
        </View>
      ) : (slots.data ?? []).length === 0 ? (
        <EmptyState
          icon="parking"
          title={t('parking:slots.empty')}
          body={canManage ? t('parking:slots.emptyBody') : undefined}
          actionLabel={canManage && filter === 'all' ? t('parking:slots.add') : undefined}
          onAction={() => setAdding(true)}
          className="mt-10"
        />
      ) : (
        <FlatList
          className="mt-4"
          data={slots.data ?? []}
          keyExtractor={(s) => s.id}
          refreshing={slots.isRefetching}
          onRefresh={() => void slots.refetch()}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <Card tight className="mb-2">
              <Row
                icon={slotIcon(item.type)}
                title={item.code}
                subtitle={subtitle(item) || undefined}
                onPress={canManage ? () => setSelected(item) : undefined}
                trailing={
                  item.status === 'BLOCKED' ? (
                    <StatusPill label={t('parking:slotStatus.BLOCKED')} tone="danger" />
                  ) : item.status === 'VISITOR' ? (
                    <StatusPill label={t('parking:slotStatus.VISITOR')} tone="info" />
                  ) : item.allocation ? (
                    <StatusPill label={formatFlat(item.allocation.flat)} tone="ink" />
                  ) : (
                    <StatusPill label={t('parking:free')} tone="success" />
                  )
                }
              />
            </Card>
          )}
        />
      )}

      <Sheet
        visible={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          setPickFlat(false);
        }}
        title={pickFlat ? t('parking:slots.allocate') : selected?.code}
      >
        {selected && pickFlat ? (
          <View className="gap-2">
            {flatOptions.map((f) => (
              <Pressable
                key={f.value}
                accessibilityRole="button"
                disabled={action.isPending}
                onPress={() => {
                  void run(
                    { kind: 'allocate', slotId: selected.id, flatId: f.value },
                    t('parking:slots.allocated', { flat: f.label }),
                  );
                }}
                className="rounded-md bg-card-nested px-4 py-3.5 active:bg-card"
              >
                <Text variant="bodyMedium">{f.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : selected ? (
          <View className="gap-2">
            {selected.allocation ? (
              <Button
                label={t('parking:slots.release')}
                onPress={() =>
                  void run({ kind: 'release', slotId: selected.id }, t('parking:slots.released'))
                }
                loading={action.isPending}
              />
            ) : selected.status !== 'BLOCKED' ? (
              <Button label={t('parking:slots.allocate')} onPress={() => setPickFlat(true)} />
            ) : null}
            {selected.status !== 'BLOCKED' ? (
              <Button
                label={t('parking:slots.block')}
                variant="white"
                onPress={() =>
                  void run(
                    { kind: 'update', slotId: selected.id, body: { status: 'BLOCKED' } },
                    t('parking:slots.updated'),
                  )
                }
              />
            ) : null}
            {selected.status !== 'VISITOR' && !selected.allocation ? (
              <Button
                label={t('parking:slots.markVisitor')}
                variant="white"
                onPress={() =>
                  void run(
                    { kind: 'update', slotId: selected.id, body: { status: 'VISITOR' } },
                    t('parking:slots.updated'),
                  )
                }
              />
            ) : null}
            {selected.status !== 'ACTIVE' ? (
              <Button
                label={t('parking:slots.unblock')}
                variant="white"
                onPress={() =>
                  void run(
                    { kind: 'update', slotId: selected.id, body: { status: 'ACTIVE' } },
                    t('parking:slots.updated'),
                  )
                }
              />
            ) : null}
          </View>
        ) : null}
      </Sheet>

      <Sheet
        visible={adding}
        onClose={() => setAdding(false)}
        title={t('parking:slots.add')}
        footer={
          <Button
            label={t('parking:slots.add')}
            onPress={() => void addSlots()}
            loading={create.isPending}
          />
        }
      >
        <View className="gap-3">
          <Input
            white
            label={t('parking:slots.prefix')}
            helper={t('parking:slots.prefixHelp')}
            value={prefix}
            onChangeText={setPrefix}
            autoCapitalize="characters"
            maxLength={10}
          />
          <View className="flex-row gap-3">
            <Input
              white
              label={t('parking:slots.from')}
              value={from}
              onChangeText={setFrom}
              keyboardType="number-pad"
              containerClassName="flex-1"
              maxLength={4}
            />
            <Input
              white
              label={t('parking:slots.to')}
              value={to}
              onChangeText={setTo}
              keyboardType="number-pad"
              containerClassName="flex-1"
              maxLength={4}
            />
          </View>
          <View>
            <Text variant="label" tone="secondary" className="mb-1.5">
              {t('parking:form.type')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ParkingSlotTypeSchema.options.map((v) => (
                <Chip
                  key={v}
                  label={t(`parking:slotType.${v}`)}
                  selected={type === v}
                  onPress={() => setType(v)}
                />
              ))}
            </View>
          </View>
          <Input
            white
            label={t('parking:slots.level')}
            value={level}
            onChangeText={setLevel}
            maxLength={20}
          />
          {codes.length > 0 ? (
            <Text variant="label" tone="secondary">
              {codes.length === 1
                ? t('parking:slots.previewOne', { first: codes[0] })
                : t('parking:slots.preview', { first: codes[0], last: codes[codes.length - 1] })}
            </Text>
          ) : null}
          {addError ? (
            <Text variant="caption" tone="danger">
              {addError}
            </Text>
          ) : null}
        </View>
      </Sheet>
    </Screen>
  );
}
