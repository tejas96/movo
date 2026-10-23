import {
  type Diet,
  DietSchema,
  type Fulfilment,
  type ItemCondition,
  ItemConditionSchema,
  type Listing,
  type ListingKind,
  MAX_LISTING_PHOTOS,
  marketContract,
  type PriceType,
  PriceTypeSchema,
} from '@movo/contracts';
import {
  BottomBar,
  Button,
  Card,
  Chip,
  DateTimeSheet,
  Input,
  Screen,
  Segmented,
  SelectField,
  Text,
  TextArea,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { type ReactNode, useState } from 'react';
import {
  Controller,
  type FieldError,
  type FieldErrors,
  type Resolver,
  useForm,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { bodyResolver, usePrefill } from '../../core/forms/contract-form';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { PhotoPickerRow, usePhotoPicker } from '../../core/photos/PhotoPickerRow';
import { useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { localeTag, shortWhen } from '../../core/util/date';
import { parseRupees, rupeesText } from '../../core/util/money';
import { useListing, useSaveListing } from './api';
import { DietMark, KIND_ICON, useAllowedKinds, useMarketSettings } from './shared';

const UNITS = ['plate', 'piece', 'kg', 'box', 'hour'] as const;
type ErrorKey = 'name' | 'price' | 'priceMax' | 'unit' | 'diet' | 'times' | 'quantity';

/** Body field → the message shown for it. The first one that failed is shown, in this order. */
const PROBLEMS: readonly (readonly [string, ErrorKey])[] = [
  ['title', 'name'],
  ['pricePaise', 'price'],
  ['unit', 'unit'],
  ['diet', 'diet'],
  ['orderBy', 'times'],
  ['quantityAvailable', 'quantity'],
];

const nextQuarter = (hours: number) => {
  const d = new Date(Date.now() + hours * 3_600_000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
};

interface ListingForm {
  kind: ListingKind;
  title: string;
  description: string;
  priceType: PriceType;
  amount: string;
  unit: string;
  diet: Diet | null;
  quantity: string;
  readyAt: Date | null;
  orderBy: Date | null;
  fulfilment: Fulfilment;
  condition: ItemCondition | null;
  sharePhone: boolean;
  network: boolean;
}

const empty = (kind: ListingKind): ListingForm => ({
  kind,
  title: '',
  description: '',
  priceType: 'FIXED',
  amount: '',
  unit: '',
  diet: null,
  quantity: '',
  readyAt: null,
  orderBy: null,
  fulfilment: 'PICKUP',
  condition: null,
  sharePhone: false,
  network: false,
});

function toForm(l: Listing): ListingForm {
  return {
    kind: l.kind,
    title: l.title,
    description: l.description ?? '',
    priceType: l.priceType,
    amount: l.pricePaise ? rupeesText(l.pricePaise) : '',
    unit: l.unit ?? '',
    diet: l.diet,
    quantity: l.quantityAvailable != null ? String(l.quantityAvailable) : '',
    readyAt: l.readyAt ? new Date(l.readyAt) : null,
    orderBy: l.orderBy ? new Date(l.orderBy) : null,
    fulfilment: l.fulfilment,
    condition: l.condition,
    sharePhone: l.showPhoneAfterAccept,
    network: l.visibility === 'NETWORK',
  };
}

function toBody(v: ListingForm, imageIds: string[], networkOn: boolean) {
  const food = v.kind === 'FOOD';
  const pricePaise = v.amount.trim() ? parseRupees(v.amount) : null;
  const qty = v.quantity.trim() ? Number.parseInt(v.quantity, 10) : null;
  return {
    kind: v.kind,
    title: v.title.trim(),
    description: v.description.trim() || null,
    priceType: v.priceType,
    pricePaise: v.priceType === 'FREE' ? null : pricePaise,
    unit: v.priceType === 'PER_UNIT' ? v.unit.trim() : null,
    diet: food ? v.diet : null,
    quantityAvailable: qty != null && !Number.isNaN(qty) ? qty : null,
    readyAt: food && v.readyAt ? v.readyAt.toISOString() : null,
    orderBy: food && v.orderBy ? v.orderBy.toISOString() : null,
    fulfilment: v.fulfilment,
    condition: v.kind === 'RESALE' ? v.condition : null,
    imageIds,
    visibility: networkOn && v.network ? ('NETWORK' as const) : ('SOCIETY' as const),
    showPhoneAfterAccept: v.sharePhone,
  };
}

/**
 * Rules the body schema cannot see: fixed and per-unit prices need an amount, a typed amount
 * must read as rupees, and food needs a diet mark and an order-by time before the ready time.
 */
function extraProblems(v: ListingForm): string[] {
  const food = v.kind === 'FOOD';
  const pricePaise = v.amount.trim() ? parseRupees(v.amount) : null;
  const needsPrice = v.priceType === 'FIXED' || v.priceType === 'PER_UNIT';
  const out: string[] = [];
  if ((needsPrice && !pricePaise) || (v.amount.trim() && !pricePaise && v.priceType !== 'FREE'))
    out.push('pricePaise');
  if (food && !v.diet) out.push('diet');
  if (food && v.readyAt && v.orderBy && v.orderBy.getTime() >= v.readyAt.getTime())
    out.push('orderBy');
  return out;
}

/** The body schema plus the rules above, with errors on the body's field names. */
function listingResolver(toBodyNow: (v: ListingForm) => unknown): Resolver<ListingForm> {
  const schema = bodyResolver(marketContract.createListing.body, toBodyNow);
  return async (values, context, options) => {
    const result = await schema(values, context, options);
    const extra = extraProblems(values);
    if (!extra.length) return result;
    const errors: Record<string, unknown> = { ...result.errors };
    for (const name of extra) errors[name] ??= { type: 'custom' } satisfies FieldError;
    return { values: {}, errors: errors as FieldErrors<ListingForm> };
  };
}

export function ListingEditorScreen() {
  const { t } = useTranslation(['market', 'common']);
  const nav = useNav();
  const toast = useToast();
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const params = useRoute<RouteProp<RootStackParamList, 'ListingEditor'>>().params;
  const listingId = params?.listingId;
  const existing = useListing(societyId, listingId ?? '');
  const save = useSaveListing(societyId, listingId);
  const settings = useMarketSettings();
  const kinds = useAllowedKinds();
  const picker = usePhotoPicker(societyId, { kind: 'LISTING_IMAGE', max: MAX_LISTING_PHOTOS });
  const [sheet, setSheet] = useState<'ready' | 'orderBy' | null>(null);

  const body = (v: ListingForm) => toBody(v, picker.ids, settings.network);
  const form = useForm<ListingForm>({
    resolver: listingResolver(body),
    defaultValues: empty(params?.kind ?? kinds[0] ?? 'PRODUCT'),
    reValidateMode: 'onSubmit',
  });
  const { reset } = picker;
  usePrefill(form, listingId ? existing.data : undefined, (l) => {
    reset(l.images);
    return toForm(l);
  });
  const errors = form.formState.errors as Record<string, unknown>;
  const found = PROBLEMS.find(([field]) => errors[field]);
  // The schema caps the price; a price over the cap gets its own message.
  const error: ErrorKey | null =
    found?.[1] === 'price' && (errors.pricePaise as FieldError | undefined)?.type === 'too_big'
      ? 'priceMax'
      : (found?.[1] ?? null);
  const formError = form.formState.errors.root?.server?.message;
  const {
    kind,
    priceType,
    unit,
    diet,
    readyAt,
    orderBy,
    fulfilment,
    condition,
    sharePhone,
    network,
  } = form.watch();

  const food = kind === 'FOOD';

  const submit = form.handleSubmit(async (values) => {
    if (picker.uploading) {
      form.setError('root.server', { message: t('market:editor.errors.uploading') });
      return;
    }
    await withErrorToast(async () => {
      const saved = await save.mutateAsync(body(values));
      toast.show(t('market:editor.saved'));
      if (listingId) nav.goBack();
      else nav.replace('Listing', { listingId: saved.id });
    });
  });

  const pickerLabels = {
    date: t('common:picker.date'),
    time: t('common:picker.time'),
    minutes: t('common:picker.minutes'),
    done: t('common:actions.done'),
  };

  if (listingId && loadFailed(existing))
    return (
      <Screen>
        <TitleBar title={t('market:editor.editTitle')} onBack={() => nav.goBack()} />
        <QueryError query={existing} className="mt-10" />
      </Screen>
    );

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={listingId ? t('market:editor.editTitle') : t('market:editor.newTitle')}
          onBack={() => nav.goBack()}
        />
        <Card className="mt-5 gap-4">
          <Field label={t('market:editor.kind')}>
            <ChipRow>
              {kinds.map((k) => (
                <Chip
                  key={k}
                  icon={KIND_ICON[k]}
                  label={t(`market:kindOne.${k}`)}
                  selected={kind === k}
                  onPress={() => form.setValue('kind', k)}
                />
              ))}
            </ChipRow>
          </Field>

          <Field label={t('market:editor.photos')} help={t('market:editor.photosHelp')}>
            <PhotoPickerRow picker={picker} showCover />
          </Field>

          <Controller
            control={form.control}
            name="title"
            render={({ field }) => (
              <Input
                label={t('market:editor.name')}
                placeholder={t('market:editor.nameHint')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={80}
                error={error === 'name' ? t('market:editor.errors.name') : undefined}
              />
            )}
          />
          <Controller
            control={form.control}
            name="description"
            render={({ field }) => (
              <TextArea
                label={t('market:editor.description')}
                placeholder={t('market:editor.descriptionHint')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={2000}
              />
            )}
          />

          <Field label={t('market:editor.priceType')}>
            <ChipRow>
              {PriceTypeSchema.options.map((p) => (
                <Chip
                  key={p}
                  label={t(`market:editor.priceTypes.${p}`)}
                  selected={priceType === p}
                  onPress={() => form.setValue('priceType', p)}
                />
              ))}
            </ChipRow>
          </Field>
          {priceType !== 'FREE' ? (
            <Controller
              control={form.control}
              name="amount"
              render={({ field }) => (
                <Input
                  label={
                    priceType === 'NEGOTIABLE'
                      ? t('market:editor.askingPrice')
                      : t('market:editor.amount')
                  }
                  value={field.value}
                  onChangeText={field.onChange}
                  keyboardType="decimal-pad"
                  placeholder="120"
                  error={
                    error === 'price'
                      ? t('market:editor.errors.price')
                      : error === 'priceMax'
                        ? t('market:editor.errors.priceMax')
                        : undefined
                  }
                />
              )}
            />
          ) : null}
          {priceType === 'PER_UNIT' ? (
            <View>
              <Controller
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <Input
                    label={t('market:editor.unit')}
                    placeholder={t('market:editor.unitHint')}
                    value={field.value}
                    onChangeText={field.onChange}
                    maxLength={20}
                    autoCapitalize="none"
                    error={error === 'unit' ? t('market:editor.errors.unit') : undefined}
                  />
                )}
              />
              <ChipRow className="mt-2">
                {UNITS.map((u) => {
                  const word = t(`market:editor.units.${u}`);
                  return (
                    <Chip
                      key={u}
                      label={word}
                      selected={unit === word}
                      onPress={() => form.setValue('unit', word)}
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
                    onPress={() => form.setValue('diet', d)}
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

          <Controller
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <Input
                label={t('market:editor.quantity')}
                helper={t('market:editor.quantityHelp')}
                value={field.value}
                onChangeText={(v) => field.onChange(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={5}
                error={error === 'quantity' ? t('market:editor.errors.quantity') : undefined}
              />
            )}
          />

          {food ? (
            <>
              <DateField
                label={t('market:editor.readyAt')}
                value={readyAt}
                onPress={() => setSheet('ready')}
                onClear={() => form.setValue('readyAt', null)}
              />
              <DateField
                label={t('market:editor.orderBy')}
                value={orderBy}
                onPress={() => setSheet('orderBy')}
                onClear={() => form.setValue('orderBy', null)}
                error={error === 'times' ? t('market:editor.errors.times') : undefined}
              />
            </>
          ) : null}

          <Field label={t('market:editor.fulfilment')}>
            <Segmented
              value={fulfilment}
              onChange={(f) => form.setValue('fulfilment', f)}
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
                    onPress={() => form.setValue('condition', c)}
                  />
                ))}
              </ChipRow>
            </Field>
          ) : null}

          <ToggleRow
            label={t('market:editor.sharePhone')}
            help={t('market:editor.sharePhoneHelp')}
            value={sharePhone}
            onChange={(v) => form.setValue('sharePhone', v)}
          />
          {settings.network ? (
            <ToggleRow
              label={t('market:editor.network')}
              help={t('market:editor.networkHelp')}
              value={network}
              onChange={(v) => form.setValue('network', v)}
            />
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
        onChange={(d) => form.setValue(sheet === 'ready' ? 'readyAt' : 'orderBy', d)}
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
      <Text variant="caption" className="mb-1.5 pl-1.5 font-medium">
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
      className={className ? `-mx-[18px] ${className}` : '-mx-[18px]'}
      contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}
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
    <View className="flex-row items-center gap-3 rounded-[22px] bg-card-nested px-[18px] py-3">
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
