import {
  type Diet,
  DietSchema,
  type Fulfilment,
  type ItemCondition,
  ItemConditionSchema,
  type ListingKind,
  type PriceType,
  PriceTypeSchema,
} from '@movo/contracts';
import {
  BottomBar,
  Button,
  Chip,
  DateTimeSheet,
  Input,
  Screen,
  Segmented,
  SelectField,
  Text,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { parseRupees, rupeesText } from '../../core/util/money';
import { localeTag } from '../../core/util/time';
import { useListing, useSaveListing } from './api';
import { PhotoPickerRow, usePhotoPicker } from './PhotoPickerRow';
import { DietMark, KIND_ICON, shortWhen, useAllowedKinds, useMarketSettings } from './shared';

const UNITS = ['plate', 'piece', 'kg', 'box', 'hour'] as const;
type ErrorKey = 'name' | 'price' | 'unit' | 'diet' | 'times' | 'uploading';

const nextQuarter = (hours: number) => {
  const d = new Date(Date.now() + hours * 3_600_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
};

export function ListingEditorScreen() {
  const { t } = useTranslation(['market', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const params = useRoute<RouteProp<RootStackParamList, 'ListingEditor'>>().params;
  const listingId = params?.listingId;
  const existing = useListing(societyId, listingId ?? '');
  const save = useSaveListing(societyId, listingId);
  const settings = useMarketSettings();
  const kinds = useAllowedKinds();
  const picker = usePhotoPicker(societyId);

  const [kind, setKind] = useState<ListingKind>(params?.kind ?? kinds[0] ?? 'PRODUCT');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceType, setPriceType] = useState<PriceType>('FIXED');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const [diet, setDiet] = useState<Diet | null>(null);
  const [quantity, setQuantity] = useState('');
  const [readyAt, setReadyAt] = useState<Date | null>(null);
  const [orderBy, setOrderBy] = useState<Date | null>(null);
  const [fulfilment, setFulfilment] = useState<Fulfilment>('PICKUP');
  const [condition, setCondition] = useState<ItemCondition | null>(null);
  const [sharePhone, setSharePhone] = useState(false);
  const [network, setNetwork] = useState(false);
  const [sheet, setSheet] = useState<'ready' | 'orderBy' | null>(null);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [loaded, setLoaded] = useState(false);

  const { reset } = picker;
  const l = existing.data;
  useEffect(() => {
    if (!l || loaded) return;
    setLoaded(true);
    setKind(l.kind);
    setTitle(l.title);
    setDescription(l.description ?? '');
    setPriceType(l.priceType);
    setAmount(l.pricePaise ? rupeesText(l.pricePaise) : '');
    setUnit(l.unit ?? '');
    setDiet(l.diet);
    setQuantity(l.quantityAvailable != null ? String(l.quantityAvailable) : '');
    setReadyAt(l.readyAt ? new Date(l.readyAt) : null);
    setOrderBy(l.orderBy ? new Date(l.orderBy) : null);
    setFulfilment(l.fulfilment);
    setCondition(l.condition);
    setSharePhone(l.showPhoneAfterAccept);
    setNetwork(l.visibility === 'NETWORK');
    reset(l.images);
  }, [l, loaded, reset]);

  const food = kind === 'FOOD';
  const needsPrice = priceType === 'FIXED' || priceType === 'PER_UNIT';

  const submit = async () => {
    setError(null);
    const pricePaise = amount.trim() ? parseRupees(amount) : null;
    const qty = quantity.trim() ? Number.parseInt(quantity, 10) : null;
    const problem: ErrorKey | null =
      title.trim().length < 2
        ? 'name'
        : (needsPrice && !pricePaise) || (amount.trim() && !pricePaise && priceType !== 'FREE')
          ? 'price'
          : priceType === 'PER_UNIT' && !unit.trim()
            ? 'unit'
            : food && !diet
              ? 'diet'
              : food && readyAt && orderBy && orderBy.getTime() >= readyAt.getTime()
                ? 'times'
                : picker.uploading
                  ? 'uploading'
                  : null;
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const saved = await save.mutateAsync({
        kind,
        title: title.trim(),
        description: description.trim() || null,
        priceType,
        pricePaise: priceType === 'FREE' ? null : pricePaise,
        unit: priceType === 'PER_UNIT' ? unit.trim() : null,
        diet: food ? diet : null,
        quantityAvailable: qty != null && !Number.isNaN(qty) ? qty : null,
        readyAt: food && readyAt ? readyAt.toISOString() : null,
        orderBy: food && orderBy ? orderBy.toISOString() : null,
        fulfilment,
        condition: kind === 'RESALE' ? condition : null,
        imageIds: picker.ids,
        visibility: settings.network && network ? 'NETWORK' : 'SOCIETY',
        showPhoneAfterAccept: sharePhone,
      });
      toast.show(t('market:editor.saved'));
      if (listingId) nav.goBack();
      else nav.replace('Listing', { listingId: saved.id });
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  const pickerLabels = {
    date: t('common:picker.date'),
    time: t('common:picker.time'),
    minutes: t('common:picker.minutes'),
    done: t('common:actions.done'),
  };

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={listingId ? t('market:editor.editTitle') : t('market:editor.newTitle')}
          onBack={() => nav.goBack()}
        />
        <View className="mt-6 gap-4">
          <Field label={t('market:editor.kind')}>
            <ChipRow>
              {kinds.map((k) => (
                <Chip
                  key={k}
                  icon={KIND_ICON[k]}
                  label={t(`market:kindOne.${k}`)}
                  selected={kind === k}
                  onPress={() => setKind(k)}
                />
              ))}
            </ChipRow>
          </Field>

          <Field label={t('market:editor.photos')} help={t('market:editor.photosHelp')}>
            <PhotoPickerRow picker={picker} />
          </Field>

          <Input
            label={t('market:editor.name')}
            placeholder={t('market:editor.nameHint')}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
            error={error === 'name' ? t('market:editor.errors.name') : undefined}
          />
          <Input
            label={t('market:editor.description')}
            placeholder={t('market:editor.descriptionHint')}
            value={description}
            onChangeText={setDescription}
            maxLength={2000}
            multiline
            style={{ minHeight: 96, textAlignVertical: 'top' }}
          />

          <Field label={t('market:editor.priceType')}>
            <ChipRow>
              {PriceTypeSchema.options.map((p) => (
                <Chip
                  key={p}
                  label={t(`market:editor.priceTypes.${p}`)}
                  selected={priceType === p}
                  onPress={() => setPriceType(p)}
                />
              ))}
            </ChipRow>
          </Field>
          {priceType !== 'FREE' ? (
            <Input
              label={
                priceType === 'NEGOTIABLE'
                  ? t('market:editor.askingPrice')
                  : t('market:editor.amount')
              }
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="120"
              error={error === 'price' ? t('market:editor.errors.price') : undefined}
            />
          ) : null}
          {priceType === 'PER_UNIT' ? (
            <View>
              <Input
                label={t('market:editor.unit')}
                placeholder={t('market:editor.unitHint')}
                value={unit}
                onChangeText={setUnit}
                maxLength={20}
                autoCapitalize="none"
                error={error === 'unit' ? t('market:editor.errors.unit') : undefined}
              />
              <ChipRow className="mt-2">
                {UNITS.map((u) => {
                  const word = t(`market:editor.units.${u}`);
                  return (
                    <Chip
                      key={u}
                      label={word}
                      selected={unit === word}
                      onPress={() => setUnit(word)}
                    />
                  );
                })}
              </ChipRow>
            </View>
          ) : null}

          {food ? (
            <Field
              label={t('market:editor.diet')}
              error={error === 'diet' ? t('market:editor.errors.diet') : undefined}
            >
              <View className="flex-row gap-2">
                {DietSchema.options.map((d) => (
                  <Pressable
                    key={d}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: diet === d }}
                    onPress={() => setDiet(d)}
                    className={
                      diet === d
                        ? 'h-chip flex-1 flex-row items-center justify-center gap-2 rounded-md border-[1.5px] border-ink bg-card-nested'
                        : 'h-chip flex-1 flex-row items-center justify-center gap-2 rounded-md border-[1.5px] border-transparent bg-card'
                    }
                  >
                    <DietMark diet={d} />
                    <Text variant="bodyMedium">{t(`market:diet.${d}`)}</Text>
                  </Pressable>
                ))}
              </View>
            </Field>
          ) : null}

          <Input
            label={t('market:editor.quantity')}
            helper={t('market:editor.quantityHelp')}
            value={quantity}
            onChangeText={(v) => setQuantity(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={5}
          />

          {food ? (
            <>
              <DateField
                label={t('market:editor.readyAt')}
                value={readyAt}
                onPress={() => setSheet('ready')}
                onClear={() => setReadyAt(null)}
              />
              <DateField
                label={t('market:editor.orderBy')}
                value={orderBy}
                onPress={() => setSheet('orderBy')}
                onClear={() => setOrderBy(null)}
                error={error === 'times' ? t('market:editor.errors.times') : undefined}
              />
            </>
          ) : null}

          <Field label={t('market:editor.fulfilment')}>
            <Segmented
              value={fulfilment}
              onChange={setFulfilment}
              options={(['PICKUP', 'DELIVERY', 'BOTH'] as const).map((f) => ({
                value: f,
                label: t(`market:editor.fulfilmentOpt.${f}`),
              }))}
            />
          </Field>

          {kind === 'RESALE' ? (
            <Field label={t('market:editor.condition')}>
              <ChipRow>
                {ItemConditionSchema.options.map((c) => (
                  <Chip
                    key={c}
                    label={t(`market:condition.${c}`)}
                    selected={condition === c}
                    onPress={() => setCondition(c)}
                  />
                ))}
              </ChipRow>
            </Field>
          ) : null}

          <ToggleRow
            label={t('market:editor.sharePhone')}
            help={t('market:editor.sharePhoneHelp')}
            value={sharePhone}
            onChange={setSharePhone}
          />
          {settings.network ? (
            <ToggleRow
              label={t('market:editor.network')}
              help={t('market:editor.networkHelp')}
              value={network}
              onChange={setNetwork}
            />
          ) : null}
          {error === 'uploading' ? (
            <Text variant="caption" tone="danger">
              {t('market:editor.errors.uploading')}
            </Text>
          ) : null}
        </View>
      </Screen>
      <BottomBar
        action={
          <Button
            label={listingId ? t('common:actions.save') : t('market:editor.post')}
            inline
            loading={save.isPending}
            disabled={picker.uploading}
            onPress={() => void submit()}
          />
        }
      />
      <DateTimeSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === 'ready' ? t('market:editor.readyAt') : t('market:editor.orderBy')}
        value={(sheet === 'ready' ? readyAt : orderBy) ?? nextQuarter(sheet === 'ready' ? 3 : 1)}
        onChange={(d) => (sheet === 'ready' ? setReadyAt(d) : setOrderBy(d))}
        days={30}
        localeTag={localeTag()}
        labels={pickerLabels}
      />
    </>
  );
}

function Field({
  label,
  help,
  error,
  children,
}: {
  label: string;
  help?: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <View>
      <Text variant="label" tone="secondary" className="mb-1.5">
        {label}
      </Text>
      {children}
      {error ? (
        <Text variant="micro" tone="danger" className="mt-1.5 font-normal">
          {error}
        </Text>
      ) : help ? (
        <Text variant="micro" tone="secondary" className="mt-1.5 font-normal">
          {help}
        </Text>
      ) : null}
    </View>
  );
}

function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className={className ? `-mx-5 ${className}` : '-mx-5'}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

function DateField({
  label,
  value,
  onPress,
  onClear,
  error,
}: {
  label: string;
  value: Date | null;
  onPress: () => void;
  onClear: () => void;
  error?: string | undefined;
}) {
  const { t } = useTranslation('market');
  return (
    <View className="flex-row items-end gap-2">
      <SelectField
        className="flex-1"
        label={label}
        value={value ? shortWhen(value.toISOString()) : undefined}
        placeholder={t('editor.notSet')}
        error={error}
        onPress={onPress}
      />
      {value ? (
        <Button
          label={t('editor.clear')}
          variant="ghost"
          size="sm"
          inline
          onPress={onClear}
          className={error ? 'mb-6' : 'mb-1.5'}
        />
      ) : null}
    </View>
  );
}

function ToggleRow({
  label,
  help,
  value,
  onChange,
}: {
  label: string;
  help: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-md bg-card px-[18px] py-3">
      <View className="flex-1">
        <Text variant="body">{label}</Text>
        <Text variant="label" tone="secondary">
          {help}
        </Text>
      </View>
      <Toggle value={value} onValueChange={onChange} />
    </View>
  );
}
