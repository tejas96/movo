import { MAX_RSVP_GUESTS, type RsvpResponse } from '@movo/contracts';
import {
  ArtCard,
  AvatarStack,
  Button,
  DIYA_SPARKS,
  Diya,
  Glass,
  Icon,
  IconSquare,
  Input,
  initialsOf,
  OptionSheet,
  Press,
  Rise,
  Row,
  Screen,
  SectionLabel,
  Sheet,
  Skeleton,
  StatusPill as SoftPill,
  Sparks,
  Strong,
  Text,
  theme,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text as RNText, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatFlat, useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { StatusPill, type StatusTones } from '../../core/ui/StatusPill';
import { whenRange } from '../../core/util/date';
import { useCancelEvent, useEvent, useEventRsvps, useRsvp } from './api';

type MenuKey = 'edit' | 'cancel';

const RSVP_TONE: StatusTones<RsvpResponse> = {
  GOING: 'success',
  MAYBE: 'warning',
  NOT_GOING: 'neutral',
};

const ANSWERS: RsvpResponse[] = ['GOING', 'MAYBE', 'NOT_GOING'];

/** Soft Glow event, laid out like docs/design/soft-glow/source/Event.dc.html. */
export function EventDetailScreen() {
  const { t } = useTranslation(['events', 'common']);
  const nav = useNav();
  const toast = useToast();
  const withErrorToast = useMutationToast();
  const societyId = useSocietyId();
  const { eventId } = useRoute<RouteProp<RootStackParamList, 'EventDetail'>>().params;
  const event = useEvent(societyId, eventId);
  const e = event.data;
  const rsvps = useEventRsvps(societyId, eventId, e?.canSeeRsvps === true);
  const rsvp = useRsvp(societyId, eventId);
  const cancel = useCancelEvent(societyId, eventId);
  const [menu, setMenu] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [burst, setBurst] = useState(0);

  const answer = async (response: RsvpResponse, guestsCount = 0) => {
    await withErrorToast(async () => {
      await rsvp.mutateAsync({ response, guestsCount });
      toast.show(t('events:rsvp.saved'));
    });
  };

  const doCancel = async () => {
    await withErrorToast(async () => {
      await cancel.mutateAsync(reason.trim() || undefined);
      toast.show(t('events:actions.cancelled'));
      setCancelOpen(false);
    });
  };

  const guests = e?.myRsvp?.response === 'GOING' ? e.myRsvp.guestsCount : 0;
  const goingFaces = (rsvps.data ?? [])
    .filter((r) => r.response === 'GOING')
    .slice(0, 3)
    .map((r) => ({ id: r.membershipId, initials: initialsOf(r.displayName) }));

  const back = (
    <IconSquare
      icon="back"
      variant="linear"
      diameter={46}
      onPress={() => nav.goBack()}
      accessibilityLabel={t('common:actions.back')}
    />
  );

  return (
    <Screen glow="warm">
      {loadFailed(event) ? (
        <View style={styles.page}>
          {back}
          <QueryError query={event} className="mt-6" />
        </View>
      ) : event.isLoading || !e ? (
        <View style={styles.page}>
          <Skeleton className="h-[342px] rounded-[40px]" />
          <Skeleton className="h-[54px] rounded-full" />
          <Skeleton className="h-40 rounded-[30px]" />
        </View>
      ) : (
        <View style={styles.page}>
          {/* Hero: the lamp on warm moving art, title and when · where at the bottom. */}
          <Rise>
            <ArtCard
              art="flame"
              height={330}
              radius={40}
              fade={0.55}
              fadeFrom={0.5}
              contentStyle={styles.hero}
            >
              <View style={styles.diya} pointerEvents="none">
                <Diya />
              </View>
              <Sparks sparks={DIYA_SPARKS} />
              <View style={styles.heroTop}>
                {back}
                {e.canManage ? (
                  <IconSquare
                    icon="more"
                    variant="linear"
                    diameter={46}
                    onPress={() => setMenu(true)}
                    accessibilityLabel={t('events:glow.options')}
                  />
                ) : null}
              </View>
              <View>
                <View style={styles.pills}>
                  <View style={styles.byPill}>
                    <View style={styles.dot} />
                    <Text variant="label" className="font-medium" numberOfLines={1}>
                      {t('events:glow.by', { name: e.createdBy.displayName })}
                    </Text>
                  </View>
                  {e.status === 'CANCELLED' ? (
                    <SoftPill label={t('events:status.CANCELLED')} tone="danger" />
                  ) : null}
                </View>
                <Text style={styles.title} numberOfLines={3}>
                  {e.title}
                </Text>
                <Text variant="caption" style={styles.when} numberOfLines={2}>
                  {whenRange(e.startsAt, e.endsAt)}
                  {e.location ? (
                    <>
                      <RNText style={styles.bar}>{'  |  '}</RNText>
                      {e.location}
                    </>
                  ) : null}
                </Text>
              </View>
            </ArtCard>
          </Rise>

          {/* Who is going. */}
          {e.rsvpEnabled ? (
            <Rise delay={80}>
              <Glass
                radius={999}
                style={[styles.goingPill, goingFaces.length === 0 && styles.goingPlain]}
              >
                {goingFaces.length > 0 ? <AvatarStack people={goingFaces} size={38} /> : null}
                <Text variant="bodyMedium" className="font-normal" numberOfLines={1}>
                  <Strong>{t('events:glow.goingCount', { count: e.goingCount })}</Strong>
                  {e.counts.maybe > 0 ? (
                    <RNText style={styles.muted}>
                      {` ${t('events:glow.maybeCount', { count: e.counts.maybe })}`}
                    </RNText>
                  ) : null}
                </Text>
              </Glass>
            </Rise>
          ) : null}

          {/* Are you going? */}
          {e.rsvpEnabled && e.status === 'PUBLISHED' ? (
            <Rise delay={140}>
              <Glass radius={30} style={styles.card}>
                <Text variant="h2" className="font-normal">
                  {t('events:glow.areYou')} <Strong>{t('events:glow.goingQ')}</Strong>
                </Text>
                {e.canRsvp ? (
                  <>
                    <View style={styles.picker} accessibilityRole="radiogroup">
                      {ANSWERS.map((a) => (
                        <AnswerButton
                          key={a}
                          label={t(`events:rsvp.${a}`)}
                          selected={e.myRsvp?.response === a}
                          disabled={rsvp.isPending}
                          onPress={() => {
                            if (a === 'GOING' && e.myRsvp?.response !== 'GOING')
                              setBurst((b) => b + 1);
                            void answer(a, a === 'GOING' ? guests : 0);
                          }}
                        />
                      ))}
                      {burst > 0 ? <Burst key={burst} /> : null}
                    </View>
                    {e.myRsvp?.response === 'GOING' ? (
                      <View style={styles.guests}>
                        <Text variant="body" tone="secondary">
                          {t('events:rsvp.guests')}
                        </Text>
                        <View style={styles.stepper}>
                          <Press
                            accessibilityRole="button"
                            accessibilityLabel={t('events:glow.lessGuest')}
                            disabled={guests === 0 || rsvp.isPending}
                            onPress={() => void answer('GOING', guests - 1)}
                            scaleTo={0.92}
                            style={[styles.step, styles.stepWhite, guests === 0 && styles.off]}
                          >
                            <Icon name="minus" size={18} color={theme.color.text.primary} />
                          </Press>
                          <Text style={styles.count}>{String(guests)}</Text>
                          <Press
                            accessibilityRole="button"
                            accessibilityLabel={t('events:glow.moreGuest')}
                            disabled={guests >= MAX_RSVP_GUESTS || rsvp.isPending}
                            onPress={() => void answer('GOING', guests + 1)}
                            scaleTo={0.92}
                            style={[
                              styles.step,
                              styles.stepInk,
                              guests >= MAX_RSVP_GUESTS && styles.off,
                            ]}
                          >
                            <Icon name="add" size={18} color={theme.color.text.inverse} />
                          </Press>
                        </View>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Text variant="body" tone="secondary" className="mt-2">
                    {e.myRsvp
                      ? t('events:rsvp.yours', { answer: t(`events:rsvp.${e.myRsvp.response}`) })
                      : t('events:rsvp.closed')}
                  </Text>
                )}
              </Glass>
            </Rise>
          ) : null}

          {e.description ? (
            <Rise delay={200}>
              <Glass radius={30} style={styles.card}>
                <SectionLabel className="px-0 pt-0 pb-0">{t('events:about')}</SectionLabel>
                <Text variant="body" style={styles.about}>
                  {e.description}
                </Text>
              </Glass>
            </Rise>
          ) : null}

          {e.canSeeRsvps ? (
            <Rise delay={240}>
              <Glass radius={28} style={styles.list}>
                <SectionLabel>{t('events:responses.title')}</SectionLabel>
                <Text variant="caption" tone="secondary" className="px-3 pb-1">
                  {t('events:responses.summary', {
                    going: e.counts.going,
                    maybe: e.counts.maybe,
                    notGoing: e.counts.notGoing,
                  })}
                </Text>
                {rsvps.data && rsvps.data.length > 0 ? (
                  rsvps.data.map((r) => (
                    <Row
                      key={r.membershipId}
                      onGray
                      icon="user"
                      title={r.displayName}
                      subtitle={[
                        r.flats.map(formatFlat).join(', '),
                        r.guestsCount > 0
                          ? t('events:responses.guests', { count: r.guestsCount })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      trailing={
                        <StatusPill value={r.response} tones={RSVP_TONE} labels="events:rsvp" />
                      }
                    />
                  ))
                ) : (
                  <Text variant="caption" tone="secondary" className="px-3 pb-3">
                    {t('events:responses.empty')}
                  </Text>
                )}
              </Glass>
            </Rise>
          ) : null}
        </View>
      )}
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        options={[
          { value: 'edit' as MenuKey, label: t('common:actions.edit') },
          { value: 'cancel' as MenuKey, label: t('events:actions.cancel') },
        ]}
        onSelect={(k) => {
          if (k === 'edit') nav.navigate('EventEditor', { eventId });
          else {
            setReason('');
            setCancelOpen(true);
          }
        }}
      />
      <Sheet
        visible={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={t('events:actions.cancelTitle')}
        footer={
          <Button
            label={t('events:actions.cancel')}
            variant="danger"
            loading={cancel.isPending}
            onPress={() => void doCancel()}
          />
        }
      >
        <Input
          label={t('events:actions.cancelReason')}
          value={reason}
          onChangeText={setReason}
          maxLength={500}
          white
        />
      </Sheet>
    </Screen>
  );
}

/** One answer in the glass picker. The chosen one turns white and bounces once. */
function AnswerButton({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!selected || reduced) return;
    s.value = withSequence(
      withTiming(1.07, { duration: 160, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 240, easing: Easing.out(Easing.back(2)) }),
    );
  }, [selected, reduced, s]);
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[styles.answerWrap, bounce]}>
      <Press
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled }}
        disabled={disabled}
        onPress={onPress}
        scaleTo={0.97}
        style={[styles.answer, selected && styles.answerOn]}
      >
        <Text variant="bodyMedium" numberOfLines={1}>
          {label}
        </Text>
      </Press>
    </Animated.View>
  );
}

const BURST_COLORS = ['#F06A2E', '#F5A3C7', '#CDB2F0', '#F6D35B', '#8FA8E0'];
const BITS = Array.from({ length: 18 }, (_, i) => {
  const a = (i / 18) * Math.PI * 2;
  const r = 60 + (i % 3) * 22;
  return {
    id: `bit-${i}`,
    color: BURST_COLORS[i % 5] as string,
    x: Math.round(Math.cos(a) * r),
    y: Math.round(Math.sin(a) * r - 30),
  };
});

/** Confetti from the Going button: 18 dots fly out and fade, once. */
function Burst() {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!reduced)
      p.value = withTiming(1, { duration: 900, easing: Easing.bezier(0.1, 0.7, 0.3, 1) });
  }, [reduced, p]);
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={styles.burst}>
      {BITS.map((b) => (
        <Bit key={b.id} bit={b} p={p} />
      ))}
    </View>
  );
}

function Bit({
  bit,
  p,
}: {
  bit: (typeof BITS)[number];
  p: ReturnType<typeof useSharedValue<number>>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [
      { translateX: bit.x * p.value },
      { translateY: bit.y * p.value },
      { scale: interpolate(p.value, [0, 1], [1, 0.4]) },
    ],
  }));
  return <Animated.View style={[styles.bit, { backgroundColor: bit.color }, style]} />;
}

const styles = StyleSheet.create({
  // The Event mockup starts 4 pt higher than the other screens (54 instead of 58).
  page: { gap: 14, marginHorizontal: -4, marginTop: -4 },
  hero: { padding: 14, justifyContent: 'space-between' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between' },
  diya: { position: 'absolute', left: 0, right: 0, top: 66, alignItems: 'center' },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  byPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    maxWidth: '100%',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.color.accent.fg },
  title: {
    marginTop: 10,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: theme.color.text.primary,
  },
  when: { color: '#4D4C52' },
  bar: { color: 'rgba(77,76,82,0.4)' },
  muted: { color: theme.color.text.secondary },
  goingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 18,
    minHeight: 54,
  },
  goingPlain: { paddingLeft: 18 },
  card: { padding: 18 },
  picker: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1.5,
    borderColor: theme.color.border.glass,
  },
  answerWrap: { flex: 1 },
  answer: { height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  answerOn: { backgroundColor: '#FFFFFF', boxShadow: '0 4px 12px rgba(70,40,70,0.1)' },
  burst: { position: 'absolute', left: '16%', top: '50%', width: 0, height: 0 },
  bit: { position: 'absolute', left: -5, top: -5, width: 10, height: 10, borderRadius: 5 },
  guests: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepWhite: { backgroundColor: '#FFFFFF', boxShadow: '0 4px 12px rgba(70,40,70,0.06)' },
  stepInk: { backgroundColor: theme.color.bg.ink },
  off: { opacity: 0.4 },
  count: {
    minWidth: 18,
    textAlign: 'center',
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 26,
    color: theme.color.text.primary,
  },
  about: { marginTop: 8, lineHeight: 22 },
  list: { padding: 8 },
});
