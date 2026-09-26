import type { Listing, OrderFulfilment } from '@movo/contracts';
import {
  BottomBar,
  Button,
  CircleButton,
  type IconName,
  IconSquare,
  Input,
  OptionSheet,
  PersonCard,
  PhotoHeader,
  Pill,
  Row,
  Screen,
  SectionHeader,
  Segmented,
  Sheet,
  Skeleton,
  Text,
  Tile,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fileUri } from '../../core/api/client';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { money } from '../../core/util/money';
import { relative } from '../../core/util/time';
import { type ListingAction, useCreateOrder, useListing, useListingAction } from './api';
import {
  coverSource,
  DietPill,
  KIND_ICON,
  ListingStatusPill,
  priceLabel,
  ratingLabel,
  Stars,
  timeAndDay,
} from './shared';

type MenuKey = 'edit' | 'pause' | 'resume' | 'archive' | 'hide' | 'unhide' | 'report';

export function ListingDetailScreen() {
  const { t } = useTranslation(['market', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const { listingId } = useRoute<RouteProp<RootStackParamList, 'Listing'>>().params;
  const listing = useListing(societyId, listingId);
  const action = useListingAction(societyId);
  const [menu, setMenu] = useState(false);
  const [reasonSheet, setReasonSheet] = useState<'report' | 'hide' | null>(null);
  const [reason, setReason] = useState('');
  const [ordering, setOrdering] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const l = listing.data;

  const run = async (a: ListingAction, ok: string) => {
    try {
      await action.mutateAsync({ listingId, action: a });
      toast.show(ok);
      setReasonSheet(null);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  const menuOptions: { value: MenuKey; label: string }[] = !l
    ? []
    : l.canEdit
      ? [
          { value: 'edit', label: t('common:actions.edit') },
          ...(l.status === 'ACTIVE'
            ? [{ value: 'pause' as const, label: t('listing.pause') }]
            : []),
          ...(l.status === 'PAUSED'
            ? [{ value: 'resume' as const, label: t('listing.resume') }]
            : []),
          ...(l.status !== 'HIDDEN'
            ? [{ value: 'archive' as const, label: t('listing.archive') }]
            : []),
        ]
      : l.canModerate
        ? [
            l.status === 'HIDDEN'
              ? { value: 'unhide', label: t('listing.unhide') }
              : { value: 'hide', label: t('listing.hide') },
            { value: 'report', label: t('listing.report') },
          ]
        : [{ value: 'report', label: t('listing.report') }];

  const onMenu = (k: MenuKey) => {
    if (k === 'edit') nav.navigate('ListingEditor', { listingId });
    else if (k === 'pause')
      void run({ kind: 'status', status: 'PAUSED' }, t('market:listing.paused'));
    else if (k === 'resume')
      void run({ kind: 'status', status: 'ACTIVE' }, t('market:listing.resumed'));
    else if (k === 'archive')
      Alert.alert(t('market:listing.archiveTitle'), t('market:listing.archiveBody'), [
        { text: t('common:actions.cancel'), style: 'cancel' },
        {
          text: t('market:listing.archive'),
          style: 'destructive',
          onPress: () =>
            void run({ kind: 'status', status: 'ARCHIVED' }, t('market:listing.archived')).then(
              () => nav.goBack(),
            ),
        },
      ]);
    else if (k === 'unhide') void run({ kind: 'unhide' }, t('market:listing.unhidden'));
    else {
      setReason('');
      setReasonSheet(k);
    }
  };

  const images = l?.images ?? [];
  const bottom = l
    ? l.myOpenOrderId
      ? {
          label: t('market:listing.viewOrder'),
          onPress: () => nav.navigate('OrderDetail', { orderId: l.myOpenOrderId as string }),
        }
      : l.canOrder
        ? { label: t('market:listing.order'), onPress: () => setOrdering(true) }
        : l.canEdit
          ? {
              label: t('common:actions.edit'),
              onPress: () => nav.navigate('ListingEditor', { listingId }),
            }
          : null
    : null;

  return (
    <>
      <Screen
        bottomBar={Boolean(bottom)}
        refreshing={listing.isRefetching}
        onRefresh={() => void listing.refetch()}
      >
        {listing.isLoading || !l ? (
          <View className="gap-3">
            <Skeleton className="h-[260px] rounded-xl" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-24 rounded-xl" />
          </View>
        ) : (
          <>
            <Pressable
              disabled={images.length === 0}
              onPress={() => setViewer(0)}
              accessibilityRole="imagebutton"
            >
              <PhotoHeader
                source={coverSource(l.images[0] ?? l.cover, l.kind)}
                height={260}
                onBack={() => nav.goBack()}
                trailing={
                  menuOptions.length > 0 ? (
                    <IconSquare
                      icon={l.canEdit || l.canModerate ? 'menu' : 'flag'}
                      variant="linear"
                      tone="white"
                      onPress={() => setMenu(true)}
                    />
                  ) : undefined
                }
              />
            </Pressable>
            {images.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="-mx-5 mt-3"
                contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
              >
                {images.slice(1).map((img, i) => (
                  <Pressable
                    key={img.id}
                    onPress={() => setViewer(i + 1)}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={t('market:listing.photo', {
                      n: i + 2,
                      total: images.length,
                    })}
                  >
                    <Image
                      source={{ uri: fileUri(img) }}
                      resizeMode="cover"
                      style={{ width: 72, height: 72, borderRadius: 20 }}
                      className="bg-card"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {l.hiddenReason || l.status === 'HIDDEN' ? (
              <Row
                className="mt-4"
                tone="danger"
                icon="eyeSlash"
                title={t('market:listing.hiddenTitle')}
                subtitle={l.hiddenReason ?? undefined}
              />
            ) : l.canEdit && l.status === 'PAUSED' ? (
              <Row className="mt-4" icon="pause" title={t('market:listing.pausedTitle')} />
            ) : null}

            <View className="mt-4 flex-row flex-wrap gap-2">
              <Pill
                icon={KIND_ICON[l.kind]}
                label={t(`market:kindOne.${l.kind}`)}
                tone="gray"
                size="sm"
              />
              {l.diet ? <DietPill diet={l.diet} /> : null}
              {l.rating ? (
                <Pill icon="star" label={ratingLabel(l.rating)} tone="gray" size="sm" />
              ) : null}
              {l.soldOut ? (
                <Pill label={t('market:card.soldOut')} tone="gray" size="sm" />
              ) : l.quantityAvailable != null ? (
                <Pill
                  icon="box"
                  label={t('market:card.left', { count: l.quantityAvailable })}
                  tone="gray"
                  size="sm"
                />
              ) : null}
              {l.canEdit && l.status !== 'ACTIVE' ? <ListingStatusPill status={l.status} /> : null}
            </View>
            <Text variant="h1" className="mt-3">
              {l.title}
            </Text>
            <Text variant="h3" tone="secondary" className="mt-0.5">
              {priceLabel(l)}
            </Text>

            <Facts listing={l} />

            {l.description ? (
              <>
                <SectionHeader title={t('market:listing.about')} />
                <Text variant="body" className="leading-6">
                  {l.description}
                </Text>
              </>
            ) : null}

            <SectionHeader title={t('market:listing.seller')} />
            <PersonCard
              name={l.seller.displayName}
              role={
                l.isMine
                  ? `${t('market:listing.seller')} · ${t('market:listing.you')}`
                  : t('market:listing.seller')
              }
            />

            <SectionHeader title={t('market:listing.reviews')} />
            {l.reviews.length === 0 ? (
              <Text variant="label" tone="secondary">
                {t('market:listing.noReviews')}
              </Text>
            ) : (
              <View className="gap-2">
                {l.reviews.map((r) => (
                  <View key={r.id} className="rounded-lg bg-card p-4">
                    <View className="flex-row items-center justify-between">
                      <Text variant="bodyMedium" className="font-semibold">
                        {r.by}
                      </Text>
                      <Stars value={r.rating} />
                    </View>
                    {r.text ? (
                      <Text variant="body" className="mt-1">
                        {r.text}
                      </Text>
                    ) : null}
                    <Text variant="label" tone="secondary" className="mt-1">
                      {relative(r.createdAt)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </Screen>
      {bottom && l ? (
        <BottomBar
          label={t('market:listing.price')}
          value={priceLabel(l)}
          action={<Button label={bottom.label} inline onPress={bottom.onPress} />}
        />
      ) : null}
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        options={menuOptions}
        onSelect={onMenu}
      />
      <Sheet
        visible={reasonSheet !== null}
        onClose={() => setReasonSheet(null)}
        title={
          reasonSheet === 'hide' ? t('market:listing.hideTitle') : t('market:listing.reportTitle')
        }
        footer={
          <Button
            label={reasonSheet === 'hide' ? t('market:listing.hide') : t('market:listing.report')}
            variant={reasonSheet === 'hide' ? 'danger' : 'ink'}
            loading={action.isPending}
            disabled={reason.trim().length < 2}
            onPress={() =>
              reasonSheet === 'hide'
                ? void run({ kind: 'hide', reason: reason.trim() }, t('market:listing.hidden'))
                : void run({ kind: 'report', reason: reason.trim() }, t('market:listing.reported'))
            }
          />
        }
      >
        <Input
          white
          multiline
          label={
            reasonSheet === 'hide'
              ? t('market:listing.hideReason')
              : t('market:listing.reportReason')
          }
          helper={
            reasonSheet === 'hide' ? t('market:listing.hideHelp') : t('market:listing.reportHelp')
          }
          value={reason}
          onChangeText={setReason}
          maxLength={300}
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />
      </Sheet>
      {l ? <OrderSheet listing={l} visible={ordering} onClose={() => setOrdering(false)} /> : null}
      <PhotoViewer
        images={images.map((i) => fileUri(i))}
        index={viewer}
        onClose={() => setViewer(null)}
      />
    </>
  );
}

function Facts({ listing: l }: { listing: Listing }) {
  const { t } = useTranslation('market');
  const facts: { key: string; icon: IconName; label: string; hint: string }[] = [
    {
      key: 'handover',
      icon: l.fulfilment === 'PICKUP' ? 'bag' : 'truck',
      label: t(`fulfilment.${l.fulfilment}`),
      hint: t('listing.facts.handover'),
    },
    ...(l.readyAt
      ? [
          {
            key: 'ready',
            icon: 'clock' as const,
            label: timeAndDay(l.readyAt).time,
            hint: `${t('listing.facts.ready')} · ${timeAndDay(l.readyAt).day}`,
          },
        ]
      : []),
    ...(l.orderBy
      ? [
          {
            key: 'orderBy',
            icon: 'calendarTick' as const,
            label: timeAndDay(l.orderBy).time,
            hint: `${t('listing.facts.orderBy')} · ${timeAndDay(l.orderBy).day}`,
          },
        ]
      : []),
    ...(l.condition
      ? [
          {
            key: 'condition',
            icon: 'tag' as const,
            label: t(`condition.${l.condition}`),
            hint: t('listing.facts.condition'),
          },
        ]
      : []),
  ];
  const rows = Array.from({ length: Math.ceil(facts.length / 3) }, (_, i) =>
    facts.slice(i * 3, i * 3 + 3),
  );
  return (
    <View className="mt-5 gap-3">
      {rows.map((row) => (
        <View key={row.map((f) => f.key).join()} className="flex-row gap-3">
          {row.map((f) => (
            <Tile key={f.key} icon={f.icon} label={f.label} hint={f.hint} disabled />
          ))}
          {Array.from({ length: 3 - row.length }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: spacers have no identity
            <View key={i} className="flex-1" />
          ))}
        </View>
      ))}
    </View>
  );
}

function OrderSheet({
  listing: l,
  visible,
  onClose,
}: {
  listing: Listing;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation(['market', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const create = useCreateOrder(societyId, l.id);
  const max = Math.min(l.quantityAvailable ?? 100, 100);
  const options: OrderFulfilment[] =
    l.fulfilment === 'BOTH' ? ['PICKUP', 'DELIVERY'] : [l.fulfilment];
  const [qty, setQty] = useState(1);
  const [fulfilment, setFulfilment] = useState<OrderFulfilment>(options[0] ?? 'PICKUP');
  const [note, setNote] = useState('');
  const total =
    l.pricePaise != null && (l.priceType === 'FIXED' || l.priceType === 'PER_UNIT')
      ? money(l.pricePaise * qty)
      : priceLabel(l);

  const submit = async () => {
    try {
      const order = await create.mutateAsync({
        quantity: qty,
        fulfilment,
        note: note.trim() || null,
      });
      toast.show(t('market:orderSheet.sent'));
      onClose();
      nav.navigate('OrderDetail', { orderId: order.id });
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={l.title}
      footer={
        <Button
          label={t('market:orderSheet.confirm')}
          loading={create.isPending}
          onPress={() => void submit()}
        />
      }
    >
      <View className="gap-4">
        <View className="flex-row items-center justify-between rounded-md bg-card-nested px-4 py-3">
          <Text variant="body">{t('market:orderSheet.quantity')}</Text>
          <View className="flex-row items-center gap-3">
            <CircleButton
              icon="minus"
              variant="linear"
              tone="gray"
              size={40}
              className={qty <= 1 ? 'opacity-40' : undefined}
              disabled={qty <= 1}
              onPress={() => setQty((q) => q - 1)}
            />
            <Text variant="h3" className="min-w-6 text-center">
              {qty}
            </Text>
            <CircleButton
              icon="add"
              variant="linear"
              tone="gray"
              size={40}
              className={qty >= max ? 'opacity-40' : undefined}
              disabled={qty >= max}
              onPress={() => setQty((q) => q + 1)}
            />
          </View>
        </View>
        <View>
          <Text variant="label" tone="secondary" className="mb-1.5">
            {t('market:orderSheet.handover')}
          </Text>
          {options.length > 1 ? (
            <Segmented
              value={fulfilment}
              onChange={setFulfilment}
              options={options.map((o) => ({ value: o, label: t(`market:fulfilment.${o}`) }))}
            />
          ) : (
            <Text variant="bodyMedium">{t(`market:fulfilment.${fulfilment}`)}</Text>
          )}
        </View>
        <Input
          white
          label={t('market:orderSheet.note')}
          placeholder={l.kind === 'FOOD' ? t('market:orderSheet.notePlaceholder') : undefined}
          value={note}
          onChangeText={setNote}
          maxLength={300}
        />
        <View className="flex-row items-center justify-between">
          <Text variant="body" tone="secondary">
            {t('market:orderSheet.total')}
          </Text>
          <Text variant="h2">{total}</Text>
        </View>
        <Text variant="label" tone="secondary">
          {t('market:orderSheet.noPayment')}
        </Text>
      </View>
    </Sheet>
  );
}

function PhotoViewer({
  images,
  index,
  onClose,
}: {
  images: string[];
  index: number | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={index !== null}
      onRequestClose={onClose}
      animationType="fade"
      statusBarTranslucent
    >
      <View className="flex-1 bg-ink">
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          initialScrollIndex={index ?? 0}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(u) => u}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Image source={{ uri: item }} resizeMode="contain" style={{ width, height }} />
          )}
        />
        <View className="absolute right-5" style={{ top: insets.top + 12 }}>
          <IconSquare icon="close" variant="linear" tone="white" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
