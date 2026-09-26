import {
  type Diet,
  type FileRef,
  type ListingKind,
  type ListingStatus,
  type ListingSummary,
  MarketplaceSettingsSchema,
  type OrderStatus,
} from '@movo/contracts';
import {
  Icon,
  type IconName,
  photos,
  StatusPill,
  type StatusTone,
  Text,
  theme,
} from '@movo/design-system';
import { formatDate, formatTime } from '@movo/i18n';
import { useTranslation } from 'react-i18next';
import { Image, type ImageSourcePropType, Pressable, View } from 'react-native';
import { fileUri } from '../../core/api/client';
import { currentLocale, i18n } from '../../core/i18n';
import { useActiveMembership } from '../../core/tenant/hooks';
import { money } from '../../core/util/money';
import { dateTime } from '../../core/util/time';

export const KINDS: readonly ListingKind[] = ['FOOD', 'PRODUCT', 'SERVICE', 'RESALE'];

export const KIND_ICON: Record<ListingKind, IconName> = {
  FOOD: 'food',
  PRODUCT: 'bag',
  SERVICE: 'services',
  RESALE: 'tag',
};

const KIND_PHOTO: Record<ListingKind, ImageSourcePropType> = {
  FOOD: photos.food,
  PRODUCT: photos.product,
  SERVICE: photos.services,
  RESALE: photos.resale,
};

/** The seller's cover photo, or a stock photo for the kind. */
export function coverSource(cover: FileRef | null, kind: ListingKind): ImageSourcePropType {
  return cover ? { uri: fileUri(cover) } : KIND_PHOTO[kind];
}

/** Marketplace settings from the tenant context (module list), with the schema defaults. */
export function useMarketSettings() {
  const m = useActiveMembership()?.modules.find((x) => x.key === 'marketplace');
  const parsed = MarketplaceSettingsSchema.safeParse(m?.settings ?? {});
  return parsed.success ? parsed.data : { network: false, foodEnabled: true, resaleEnabled: true };
}

/** Kinds this society allows, in display order. */
export function useAllowedKinds(): ListingKind[] {
  const s = useMarketSettings();
  return KINDS.filter(
    (k) => (k !== 'FOOD' || s.foodEnabled) && (k !== 'RESALE' || s.resaleEnabled),
  );
}

type PriceFields = Pick<ListingSummary, 'priceType' | 'pricePaise' | 'unit'>;

/** "FREE", "Negotiable", "₹120 per plate", "₹450". */
export function priceLabel(l: PriceFields): string {
  const t = i18n.getFixedT(null, 'market');
  if (l.priceType === 'FREE') return t('price.free');
  if (l.priceType === 'NEGOTIABLE')
    return l.pricePaise
      ? t('price.negotiableFrom', { price: money(l.pricePaise) })
      : t('price.negotiable');
  if (l.pricePaise == null) return '';
  if (l.priceType === 'PER_UNIT' && l.unit)
    return t('price.perUnit', { price: money(l.pricePaise), unit: l.unit });
  return money(l.pricePaise);
}

const TZ = 'Asia/Kolkata';

/** "12:30 pm" today, otherwise "Sat, 3 Oct, 12:30 pm". */
export function shortWhen(iso: string | null | undefined): string {
  if (!iso) return '';
  const locale = currentLocale();
  const same =
    formatDate(iso, locale, 'medium', TZ) ===
    formatDate(new Date().toISOString(), locale, 'medium', TZ);
  return same ? formatTime(iso, locale, TZ) : dateTime(iso);
}

/** Time and day apart, for small tiles: { time: "8:30 am", day: "Mon, 28 Sept" }. */
export function timeAndDay(iso: string): { time: string; day: string } {
  const locale = currentLocale();
  return { time: formatTime(iso, locale, TZ), day: formatDate(iso, locale, 'short', TZ) };
}

/** "Ready 12:30 pm · order by 11 am" for food. Empty when neither is set. */
export function foodTimes(l: Pick<ListingSummary, 'readyAt' | 'orderBy'>): string {
  const t = i18n.getFixedT(null, 'market');
  return [
    l.readyAt ? t('card.ready', { time: shortWhen(l.readyAt) }) : null,
    l.orderBy ? t('card.orderBy', { time: shortWhen(l.orderBy) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

const DIET_COLOR: Record<Diet, string> = {
  VEG: theme.color.status.success.fg,
  EGG: theme.color.status.warning.fg,
  NON_VEG: theme.color.status.danger.fg,
};

/** The small square-with-a-dot food mark. The only colour in the market besides photos. */
export function DietMark({ diet, size = 14 }: { diet: Diet; size?: number }) {
  const color = DIET_COLOR[diet];
  return (
    <View
      style={{ width: size, height: size, borderColor: color, borderWidth: 1.5, borderRadius: 3 }}
      className="items-center justify-center"
    >
      <View
        style={{
          width: size * 0.45,
          height: size * 0.45,
          borderRadius: size,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/** A pill with the diet mark. overlay = on a photo. */
export function DietPill({
  diet,
  tone = 'gray',
}: {
  diet: Diet;
  tone?: 'overlay' | 'gray' | 'white';
}) {
  const { t } = useTranslation('market');
  const bg = tone === 'overlay' ? 'bg-overlay' : tone === 'white' ? 'bg-card-nested' : 'bg-card';
  return (
    <View className={`h-pill-sm flex-row items-center gap-1.5 self-start rounded-full px-3 ${bg}`}>
      <DietMark diet={diet} />
      <Text variant="caption" className="font-medium">
        {t(`diet.${diet}`)}
      </Text>
    </View>
  );
}

/** 44 rounded thumbnail for rows. */
export function Thumb({
  cover,
  kind,
  size = 44,
}: {
  cover: FileRef | null;
  kind: ListingKind;
  size?: number;
}) {
  return (
    <Image
      source={coverSource(cover, kind)}
      resizeMode="cover"
      style={{ width: size, height: size, borderRadius: theme.radius.sm }}
      className="bg-card-deep"
    />
  );
}

const ORDER_TONE: Record<OrderStatus, StatusTone> = {
  REQUESTED: 'warning',
  ACCEPTED: 'info',
  READY: 'ink',
  COMPLETED: 'success',
  REJECTED: 'neutral',
  CANCELLED: 'neutral',
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const { t } = useTranslation('market');
  return <StatusPill label={t(`orderStatus.${status}`)} tone={ORDER_TONE[status]} />;
}

const LISTING_TONE: Record<ListingStatus, StatusTone> = {
  ACTIVE: 'success',
  PAUSED: 'neutral',
  ARCHIVED: 'neutral',
  HIDDEN: 'danger',
};

export function ListingStatusPill({ status }: { status: ListingStatus }) {
  const { t } = useTranslation('market');
  return <StatusPill label={t(`status.${status}`)} tone={LISTING_TONE[status]} />;
}

/** "4.5 (12)" */
export function ratingLabel(r: { average: number; count: number }): string {
  return `${r.average.toFixed(1)} (${r.count})`;
}

/** Five black stars, filled up to the rating. Pressable when onChange is given. */
export function Stars({
  value,
  size = 16,
  onChange,
}: {
  value: number;
  size?: number;
  onChange?: (n: number) => void;
}) {
  return (
    <View className={onChange ? 'flex-row gap-2' : 'flex-row gap-0.5'}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={String(n)}
            accessibilityState={{ selected: n === value }}
            onPress={() => onChange(n)}
            className={
              n <= value
                ? 'h-12 w-12 items-center justify-center rounded-md bg-ink'
                : 'h-12 w-12 items-center justify-center rounded-md bg-card'
            }
          >
            <Icon
              name="star"
              variant="bold"
              size={size}
              color={n <= value ? theme.color.icon.onInk : theme.color.text.tertiary}
            />
          </Pressable>
        ) : (
          <Icon key={n} name="star" variant={n <= value ? 'bold' : 'linear'} size={size} />
        ),
      )}
    </View>
  );
}
