import {
  ArtCard,
  Building,
  Button,
  Glass,
  IconSquare,
  Rise,
  Screen,
  Strong,
  Text,
  theme,
} from '@movo/design-system';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { useNav } from '../../core/navigation/types';
import { useMeContext } from '../../core/tenant/hooks';
import { dateTime } from '../../core/util/date';
import { useCancelJoinRequest } from './api';

/** The wait for approval, shown as the society you asked for and three steps. */
export function PendingScreen() {
  const { t } = useTranslation(['onboarding', 'common']);
  const nav = useNav();
  const withErrorToast = useMutationToast();
  const ctx = useMeContext();
  const cancel = useCancelJoinRequest();
  const pending = ctx.data?.pendingJoinRequests[0];
  const flat = pending
    ? pending.buildingName
      ? `${pending.buildingName}-${pending.flatNumber}`
      : pending.flatNumber
    : '';

  const withdraw = async () => {
    if (!pending) return;
    await withErrorToast(async () => {
      await cancel.mutateAsync(pending.id);
      nav.navigate('Join');
    });
  };

  return (
    <Screen refreshing={ctx.isFetching} onRefresh={() => void ctx.refetch()}>
      <View style={styles.page}>
        <Rise>
          <View style={styles.titleRow}>
            <IconSquare
              icon="back"
              variant="linear"
              diameter={46}
              onPress={() => nav.navigate('Join')}
              accessibilityLabel={t('common:actions.back')}
            />
            <Text variant="greet" className="flex-1" numberOfLines={1}>
              {t('onboarding:glow.pendingA')} <Strong>{t('onboarding:glow.pendingB')}</Strong>
            </Text>
          </View>
        </Rise>

        {/* The society asked for, with the requested flat on the building's pin. */}
        <Rise delay={60}>
          <ArtCard art="dusk" height={200} contentStyle={styles.hero}>
            <View style={styles.heroText}>
              <Text variant="h2" numberOfLines={2}>
                {pending?.society.name ?? t('onboarding:pendingTitle')}
              </Text>
              {pending ? (
                <Text variant="caption" tone="soft" numberOfLines={2}>
                  {t('onboarding:pendingRequested', { flat, when: dateTime(pending.createdAt) })}
                </Text>
              ) : null}
            </View>
            <View style={styles.heroArt} pointerEvents="none">
              <Building width={120} pin={flat || undefined} />
            </View>
          </ArtCard>
        </Rise>

        <Rise delay={120}>
          <Glass radius={30} style={styles.steps}>
            <Step
              state="done"
              title={t('onboarding:steps.sent')}
              hint={pending ? dateTime(pending.createdAt) : undefined}
            />
            <Connector done />
            <Step
              state="live"
              title={t('onboarding:steps.review')}
              hint={t('onboarding:steps.reviewHint')}
            />
            <Connector />
            <Step
              state="next"
              title={t('onboarding:steps.in')}
              hint={t('onboarding:steps.inHint')}
            />
          </Glass>
        </Rise>

        <Rise delay={180}>
          <View style={styles.actions}>
            <Button
              label={t('onboarding:orInvite')}
              variant="white"
              onPress={() => nav.navigate('Join')}
            />
            {pending ? (
              <Button
                label={t('onboarding:cancelRequest')}
                variant="ghost"
                onPress={() => void withdraw()}
                loading={cancel.isPending}
              />
            ) : null}
          </View>
        </Rise>
      </View>
    </Screen>
  );
}

function Step({
  state,
  title,
  hint,
}: {
  state: 'done' | 'live' | 'next';
  title: string;
  hint?: string | undefined;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.dotWrap}>
        {state === 'live' ? <Pulse /> : null}
        <View
          style={[
            styles.dot,
            state === 'done' && styles.dotDone,
            state === 'live' && styles.dotLive,
          ]}
        >
          {state === 'done' ? <View style={styles.tick} /> : null}
          {state === 'live' ? <View style={styles.core} /> : null}
        </View>
      </View>
      <View className="flex-1 gap-0.5" style={styles.stepText}>
        <Text variant="title" tone={state === 'next' ? 'secondary' : 'primary'}>
          {title}
        </Text>
        {hint ? (
          <Text variant="caption" tone="secondary">
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Connector({ done }: { done?: boolean }) {
  return <View style={[styles.connector, done && styles.connectorDone]} />;
}

/** A ring that grows and fades behind the live step, every 1.8 s. */
function Pulse() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1);
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - p.value),
    transform: [{ scale: 0.7 + p.value * 0.9 }],
  }));
  return <Animated.View style={[styles.pulse, style]} />;
}

const DOT = 24;

const styles = StyleSheet.create({
  page: { gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hero: { flexDirection: 'row', alignItems: 'flex-end' },
  heroText: { flex: 1, gap: 4, paddingBottom: 2 },
  heroArt: { marginRight: -6, marginBottom: -10 },
  steps: { padding: 18 },
  actions: { gap: 8 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepText: { paddingTop: 1 },
  dotWrap: { width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: 'rgba(43,42,46,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: theme.color.bg.ink },
  dotLive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: theme.color.accent.fg,
  },
  tick: {
    width: 6,
    height: 11,
    marginTop: -2,
    borderColor: theme.color.text.onInk,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  core: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.accent.fg },
  pulse: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: theme.color.accent.fg,
  },
  connector: {
    width: 2,
    height: 26,
    marginLeft: DOT / 2 - 1,
    marginVertical: 4,
    borderRadius: 1,
    backgroundColor: 'rgba(43,42,46,0.12)',
  },
  connectorDone: { backgroundColor: theme.color.bg.ink },
});
