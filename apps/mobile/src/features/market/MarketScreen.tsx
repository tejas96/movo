import type { ListingKind, ListingSummary } from '@movo/contracts';
import {
  Chip,
  EmptyState,
  Icon,
  IconSquare,
  OptionSheet,
  PhotoCard,
  Pill,
  photos,
  SearchBar,
  SectionHeader,
  Skeleton,
  StatusPill,
  Text,
  TitleBar,
  theme,
} from '@movo/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, ScrollView, StatusBar, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { useHomeSummary } from '../home/api';
import { useListings } from './api';
import {
  coverSource,
  DietPill,
  foodTimes,
  KIND_ICON,
  priceLabel,
  ratingLabel,
  useAllowedKinds,
} from './shared';

type KindFilter = ListingKind | 'ALL';
type MenuKey = 'mine' | 'reports';

export function MarketScreen() {
  const { t } = useTranslation(['market', 'common']);
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = (width - theme.layout.gutter * 2 - 12) / 2;
  const societyId = useSocietyId();
  const canModerate = useCan('marketplace.moderate');
  const kinds = useAllowedKinds();
  const summary = useHomeSummary(societyId);
  const waiting = summary.data?.attention.some((a) => a.type === 'MARKET_ORDERS_WAITING');
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);
  const [kind, setKind] = useState<KindFilter>('ALL');
  const [menu, setMenu] = useState(false);
  const activeKind = kind !== 'ALL' && !kinds.includes(kind) ? 'ALL' : kind;
  const foodOn = kinds.includes('FOOD');

  const list = useListings(societyId, activeKind === 'ALL' ? undefined : activeKind, q);
  const showFoodRow = activeKind === 'ALL' && foodOn;
  const food = useListings(societyId, 'FOOD', q, showFoodRow);
  const foodItems = showFoodRow ? (food.data?.pages[0]?.items ?? []) : [];
  const all = list.data?.pages.flatMap((p) => p.items) ?? [];
  // The food row already shows food on "All", so the grid shows everything else.
  const grid = foodItems.length > 0 ? all.filter((l) => l.kind !== 'FOOD') : all;
  const loading = list.isLoading;
  const empty = !loading && grid.length === 0 && foodItems.length === 0;

  const refresh = () => {
    void list.refetch();
    if (showFoodRow) void food.refetch();
  };

  const header = (
    <View>
      <TitleBar
        large
        title={t('market:title')}
        trailing={
          <View className="flex-row gap-2">
            <IconSquare
              icon="menu"
              variant="linear"
              accessibilityLabel={t('market:myListings')}
              onPress={() => setMenu(true)}
            />
            <IconSquare
              icon="receipt"
              variant="linear"
              dot={waiting}
              accessibilityLabel={t('market:myOrders')}
              onPress={() => nav.navigate('Orders')}
            />
            <IconSquare
              icon="add"
              variant="linear"
              tone="ink"
              accessibilityLabel={t('market:sell')}
              onPress={() => nav.navigate('ListingEditor')}
            />
          </View>
        }
      />
      <SearchBar
        className="mt-5"
        placeholder={t('market:search')}
        value={text}
        onChangeText={setText}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5 mt-4"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        {(['ALL', ...kinds] as KindFilter[]).map((k) => (
          <Chip
            key={k}
            label={t(`market:kind.${k}`)}
            icon={k === 'ALL' ? 'market' : KIND_ICON[k]}
            selected={activeKind === k}
            onPress={() => setKind(k)}
          />
        ))}
      </ScrollView>
      {foodItems.length > 0 ? (
        <>
          <SectionHeader title={t('market:home.freshFood')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-5"
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {foodItems.map((l) => (
              <FoodCard key={l.id} listing={l} />
            ))}
          </ScrollView>
        </>
      ) : null}
      {grid.length > 0 ? (
        <SectionHeader
          title={activeKind === 'FOOD' ? t('market:home.freshFood') : t('market:home.all')}
        />
      ) : null}
      {loading ? (
        <View className="mt-5 flex-row gap-3">
          <Skeleton className="h-56 flex-1 rounded-xl" />
          <Skeleton className="h-56 flex-1 rounded-xl" />
        </View>
      ) : null}
      {empty ? (
        <EmptyState
          photo={photos.market}
          icon="market"
          title={q ? t('market:home.emptySearch') : t('market:home.empty')}
          body={q ? undefined : t('market:home.emptyBody')}
          actionLabel={q ? undefined : t('market:home.sellSomething')}
          onAction={() => nav.navigate('ListingEditor')}
          className="mt-4"
        />
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-canvas" style={{ paddingTop: insets.top }}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={grid}
        keyExtractor={(l) => l.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: 4 }}
        contentContainerStyle={{
          paddingHorizontal: theme.layout.gutter,
          paddingTop: 8,
          gap: 12,
          paddingBottom:
            theme.layout.tabBar.height + theme.layout.tabBar.bottom + 24 + insets.bottom,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshing={list.isRefetching && !list.isFetchingNextPage}
        onRefresh={refresh}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
        }}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
            <ListingCard listing={item} />
          </View>
        )}
        ListFooterComponent={
          list.isFetchingNextPage ? <Skeleton className="h-10 rounded-lg" /> : undefined
        }
      />
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        options={[
          { value: 'mine' as MenuKey, label: t('market:myListings') },
          ...(canModerate ? [{ value: 'reports' as MenuKey, label: t('market:reportsLink') }] : []),
        ]}
        onSelect={(k) =>
          k === 'mine' ? nav.navigate('MyListings') : nav.navigate('MarketReports')
        }
      />
    </View>
  );
}

function SoldState({ listing }: { listing: ListingSummary }) {
  const { t } = useTranslation('market');
  if (listing.soldOut) return <StatusPill label={t('card.soldOut')} tone="neutral" />;
  if (listing.ordersClosed) return <StatusPill label={t('card.closed')} tone="neutral" />;
  return null;
}

/** Wide card for the horizontal "Fresh homemade food" row. */
function FoodCard({ listing: l }: { listing: ListingSummary }) {
  const { t } = useTranslation('market');
  const nav = useNav();
  const dim = l.soldOut || l.ordersClosed;
  const times = foodTimes(l);
  return (
    <PhotoCard
      source={coverSource(l.cover, l.kind)}
      photoHeight={150}
      leading={l.diet ? <DietPill diet={l.diet} tone="overlay" /> : undefined}
      action={<SoldState listing={l} />}
      className={dim ? 'opacity-60' : undefined}
      onPress={() => nav.navigate('Listing', { listingId: l.id })}
    >
      <View style={{ width: 240 }}>
        <Text variant="h3" numberOfLines={1}>
          {l.title}
        </Text>
        <Text variant="bodyMedium" className="mt-0.5" numberOfLines={1}>
          {priceLabel(l)}
        </Text>
        {times ? (
          <View className="mt-1.5 flex-row items-center gap-1.5">
            <Icon name="clock" variant="bold" size={16} color={theme.color.icon.secondary} />
            <Text variant="label" tone="secondary" numberOfLines={1} className="shrink">
              {times}
            </Text>
          </View>
        ) : null}
        <Text variant="label" tone="secondary" numberOfLines={1} className="mt-1">
          {t('card.by', { name: l.seller.displayName })}
        </Text>
      </View>
    </PhotoCard>
  );
}

/** Small grid card: photo with the kind pill, title, price, rating. */
function ListingCard({ listing: l }: { listing: ListingSummary }) {
  const { t } = useTranslation('market');
  const nav = useNav();
  return (
    <PhotoCard
      source={coverSource(l.cover, l.kind)}
      photoHeight={128}
      leading={
        l.diet ? (
          <DietPill diet={l.diet} tone="overlay" />
        ) : (
          <Pill icon={KIND_ICON[l.kind]} label={t(`kindOne.${l.kind}`)} tone="overlay" size="sm" />
        )
      }
      className={l.soldOut || l.ordersClosed ? 'opacity-60' : undefined}
      onPress={() => nav.navigate('Listing', { listingId: l.id })}
    >
      <View className="-mx-1 -mb-1 -mt-1">
        <Text variant="bodyMedium" className="font-semibold" numberOfLines={1}>
          {l.title}
        </Text>
        <Text variant="label" tone="secondary" numberOfLines={1} className="mt-0.5">
          {priceLabel(l)}
        </Text>
        {l.rating || l.soldOut || l.ordersClosed ? (
          <View className="mt-2 flex-row flex-wrap gap-1.5">
            {l.rating ? (
              <Pill icon="star" label={ratingLabel(l.rating)} tone="white" size="sm" />
            ) : null}
            <SoldState listing={l} />
          </View>
        ) : null}
      </View>
    </PhotoCard>
  );
}
