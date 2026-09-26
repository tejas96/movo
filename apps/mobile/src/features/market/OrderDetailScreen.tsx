import type { Order, OrderMessage } from '@movo/contracts';
import {
  Button,
  Card,
  CircleButton,
  Input,
  PersonCard,
  PhotoCard,
  Row,
  Screen,
  SectionHeader,
  Sheet,
  Skeleton,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, ScrollView, type ScrollViewInstance, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { money } from '../../core/util/money';
import { relative } from '../../core/util/time';
import { type OrderAction, useOrder, useOrderAction } from './api';
import { coverSource, OrderStatusPill, Stars, shortWhen } from './shared';

export function OrderDetailScreen() {
  const { t } = useTranslation(['market', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const { orderId } = useRoute<RouteProp<RootStackParamList, 'OrderDetail'>>().params;
  const order = useOrder(societyId, orderId);
  const action = useOrderAction(societyId, orderId);
  const scroll = useRef<ScrollViewInstance>(null);
  const [reasonSheet, setReasonSheet] = useState<'reject' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [draft, setDraft] = useState('');
  const o = order.data;

  const run = async (a: OrderAction, ok?: string) => {
    try {
      await action.mutateAsync(a);
      if (ok) toast.show(ok);
      setReasonSheet(null);
      return true;
    } catch (e) {
      toast.show(toMessage(e), 'error');
      return false;
    }
  };

  const complete = () =>
    Alert.alert(t('market:order.completeTitle'), t('market:order.completeBody'), [
      { text: t('common:actions.cancel'), style: 'cancel' },
      {
        text: t('common:actions.confirm'),
        onPress: () => void run({ kind: 'complete' }, t('market:order.completed')),
      },
    ]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    if (await run({ kind: 'message', body })) {
      setDraft('');
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  return (
    <Screen scroll={false}>
      <TitleBar title={t('market:order.title')} onBack={() => nav.goBack()} />
      {order.isLoading || !o ? (
        <Skeleton className="mt-6 h-64 rounded-xl" />
      ) : (
        <View className="flex-1">
          <ScrollView
            ref={scroll}
            className="-mx-5 mt-4 flex-1"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <PhotoCard
              source={coverSource(o.listing.cover, o.listing.kind)}
              photoHeight={160}
              action={<OrderStatusPill status={o.status} />}
              onPress={() => nav.navigate('Listing', { listingId: o.listing.id })}
            >
              <Text variant="h3" numberOfLines={2}>
                {o.listing.title}
              </Text>
              <Text variant="label" tone="secondary" className="mt-0.5">
                {relative(o.createdAt)}
              </Text>
            </PhotoCard>

            <Card tight className="mt-4 gap-2">
              <Row
                icon="box"
                title={t('market:order.quantity')}
                trailing={<Value text={qtyText(o)} />}
              />
              <Row
                icon="wallet"
                title={t('market:order.total')}
                subtitle={t('market:order.payNote')}
                trailing={
                  <Value
                    text={
                      o.totalPaise != null ? money(o.totalPaise) : t('market:order.priceToAgree')
                    }
                  />
                }
              />
              <Row
                icon={o.fulfilment === 'PICKUP' ? 'bag' : 'truck'}
                title={t('market:order.handover')}
                trailing={<Value text={t(`market:fulfilment.${o.fulfilment}`)} />}
              />
              {o.readyAt ? (
                <Row
                  icon="clock"
                  title={t('market:order.readyAt')}
                  trailing={<Value text={shortWhen(o.readyAt)} />}
                />
              ) : null}
              {o.note ? <Row icon="chat" title={t('market:order.note')} subtitle={o.note} /> : null}
              {o.reason ? (
                <Row icon="info" title={t('market:order.reason')} subtitle={o.reason} />
              ) : null}
            </Card>

            <Actions
              order={o}
              busy={action.isPending}
              onRun={run}
              onComplete={complete}
              onReason={(k) => {
                setReason('');
                setReasonSheet(k);
              }}
            />

            <SectionHeader
              title={o.role === 'BUYING' ? t('market:order.seller') : t('market:order.buyer')}
            />
            <Party
              party={o.role === 'BUYING' ? o.seller : o.buyer}
              role={o.role === 'BUYING' ? t('market:order.seller') : t('market:order.buyer')}
            />
            {o.status === 'REQUESTED' ? (
              <Text variant="label" tone="secondary" className="mt-2">
                {t('market:order.contactAfterAccept')}
              </Text>
            ) : null}

            {o.review ? (
              <>
                <SectionHeader title={t('market:order.yourReview')} />
                <View className="rounded-lg bg-card p-4">
                  <Stars value={o.review.rating} />
                  {o.review.text ? (
                    <Text variant="body" className="mt-2">
                      {o.review.text}
                    </Text>
                  ) : null}
                  <Text variant="label" tone="secondary" className="mt-1">
                    {`${o.review.by} · ${relative(o.review.createdAt)}`}
                  </Text>
                </View>
              </>
            ) : o.canReview ? (
              <ReviewForm
                busy={action.isPending}
                onSubmit={(rating, text) =>
                  void run({ kind: 'review', rating, text }, t('market:order.reviewed'))
                }
              />
            ) : null}

            <SectionHeader title={t('market:order.messages')} />
            {o.messages.length === 0 ? (
              <Text variant="label" tone="secondary">
                {t('market:order.noMessages')}
              </Text>
            ) : (
              <View className="gap-2">
                {o.messages.map((m) => (
                  <Bubble key={m.id} message={m} />
                ))}
              </View>
            )}
          </ScrollView>
          {o.canMessage ? (
            <View className="flex-row items-end gap-2 pb-3 pt-2">
              <View className="flex-1">
                <Input
                  placeholder={t('market:order.messagePlaceholder')}
                  value={draft}
                  onChangeText={setDraft}
                  maxLength={500}
                  multiline
                  style={{ maxHeight: 100 }}
                />
              </View>
              <CircleButton
                icon="send"
                size={56}
                accessibilityLabel={t('market:order.send')}
                disabled={!draft.trim() || action.isPending}
                className={!draft.trim() ? 'opacity-40' : undefined}
                onPress={() => void send()}
              />
            </View>
          ) : null}
        </View>
      )}
      <Sheet
        visible={reasonSheet !== null}
        onClose={() => setReasonSheet(null)}
        title={
          reasonSheet === 'reject' ? t('market:order.declineTitle') : t('market:order.cancelTitle')
        }
        footer={
          <Button
            label={reasonSheet === 'reject' ? t('market:order.decline') : t('market:order.cancel')}
            variant="danger"
            loading={action.isPending}
            onPress={() =>
              reasonSheet &&
              void run(
                { kind: reasonSheet, reason: reason.trim() || undefined },
                reasonSheet === 'reject' ? t('market:order.declined') : t('market:order.cancelled'),
              )
            }
          />
        }
      >
        <Input
          white
          multiline
          label={t('market:order.reasonOptional')}
          value={reason}
          onChangeText={setReason}
          maxLength={300}
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />
      </Sheet>
    </Screen>
  );
}

function qtyText(o: Order): string {
  return o.listing.unit ? `${o.quantity} ${o.listing.unit}` : String(o.quantity);
}

function Value({ text }: { text: string }) {
  return (
    <Text variant="bodyMedium" className="font-semibold" numberOfLines={1}>
      {text}
    </Text>
  );
}

function Actions({
  order: o,
  busy,
  onRun,
  onComplete,
  onReason,
}: {
  order: Order;
  busy: boolean;
  onRun: (a: OrderAction, ok?: string) => Promise<boolean>;
  onComplete: () => void;
  onReason: (k: 'reject' | 'cancel') => void;
}) {
  const { t } = useTranslation('market');
  const primary = o.canAccept
    ? {
        label: t('order.accept'),
        onPress: () => void onRun({ kind: 'accept' }, t('order.accepted')),
      }
    : o.canMarkReady
      ? {
          label: t('order.markReady'),
          onPress: () => void onRun({ kind: 'ready' }, t('order.readyDone')),
        }
      : o.canComplete
        ? {
            label: o.role === 'BUYING' ? t('order.received') : t('order.complete'),
            onPress: onComplete,
          }
        : null;
  // Mark ready and complete can both be open for the seller; show complete as the second step.
  const secondComplete = o.canMarkReady && o.canComplete;
  if (!primary && !o.canReject && !o.canCancel) return null;
  return (
    <View className="mt-4 gap-2">
      {primary ? <Button label={primary.label} loading={busy} onPress={primary.onPress} /> : null}
      {secondComplete ? (
        <Button
          label={o.role === 'BUYING' ? t('order.received') : t('order.complete')}
          variant="gray"
          onPress={onComplete}
        />
      ) : null}
      {o.canReject ? (
        <Button label={t('order.decline')} variant="gray" onPress={() => onReason('reject')} />
      ) : null}
      {o.canCancel ? (
        <Button label={t('order.cancel')} variant="ghost" onPress={() => onReason('cancel')} />
      ) : null}
    </View>
  );
}

function Party({ party, role }: { party: Order['buyer']; role: string }) {
  const { t } = useTranslation('market');
  return (
    <PersonCard
      name={party.displayName}
      role={[role, party.flat ? t('order.flat', { flat: party.flat }) : null]
        .filter(Boolean)
        .join(' · ')}
      actions={
        party.phone ? (
          <CircleButton
            icon="call"
            accessibilityLabel={party.phone}
            onPress={() => void Linking.openURL(`tel:${party.phone}`)}
          />
        ) : undefined
      }
    />
  );
}

function Bubble({ message: m }: { message: OrderMessage }) {
  return (
    <View
      className={
        m.mine
          ? 'max-w-[80%] self-end rounded-lg rounded-br-sm bg-ink px-4 py-2.5'
          : 'max-w-[80%] self-start rounded-lg rounded-bl-sm bg-card px-4 py-2.5'
      }
    >
      <Text variant="body" tone={m.mine ? 'inverse' : 'primary'}>
        {m.body}
      </Text>
      <Text
        variant="micro"
        tone={m.mine ? 'inverse' : 'secondary'}
        className="mt-0.5 font-normal opacity-70"
      >
        {m.mine ? relative(m.createdAt) : `${m.by} · ${relative(m.createdAt)}`}
      </Text>
    </View>
  );
}

function ReviewForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (rating: number, text: string | null) => void;
}) {
  const { t } = useTranslation('market');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  return (
    <>
      <SectionHeader title={t('order.review')} />
      <Stars value={rating} size={22} onChange={setRating} />
      <Input
        containerClassName="mt-3"
        placeholder={t('order.reviewPlaceholder')}
        value={text}
        onChangeText={setText}
        maxLength={500}
        multiline
        style={{ minHeight: 72, textAlignVertical: 'top' }}
      />
      <Button
        className="mt-3"
        variant="gray"
        label={t('order.sendReview')}
        loading={busy}
        disabled={rating === 0}
        onPress={() => onSubmit(rating, text.trim() || null)}
      />
    </>
  );
}
