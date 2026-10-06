import { Button, IconSquare, photos, Screen, Text, theme, useToast } from '@movo/design-system';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { useMeContext } from '../../core/tenant/hooks';
import { dateTime } from '../../core/util/time';
import { useCancelJoinRequest } from './api';

/** The wait for approval, shown as the society you asked for and three steps. */
export function PendingScreen() {
  const { t } = useTranslation(['onboarding', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
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
    try {
      await cancel.mutateAsync(pending.id);
      nav.navigate('Join');
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <Screen refreshing={ctx.isFetching} onRefresh={() => void ctx.refetch()}>
      <View className="flex-row items-center gap-3">
        <IconSquare icon="back" variant="linear" onPress={() => nav.navigate('Join')} />
        <Text variant="h3">{t('onboarding:pendingHeadline')}</Text>
      </View>

      <View style={styles.photoCard} className="mt-6">
        <Image source={photos.society2} resizeMode="cover" style={styles.photo} />
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id="pendingScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.3" stopColor="#000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000" stopOpacity="0.72" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#pendingScrim)" />
        </Svg>
        <View style={styles.photoText}>
          <Text variant="h3" tone="inverse" numberOfLines={1}>
            {pending?.society.name ?? t('onboarding:pendingTitle')}
          </Text>
          {pending ? (
            <Text variant="label" style={styles.photoSub} numberOfLines={1}>
              {t('onboarding:pendingRequested', { flat, when: dateTime(pending.createdAt) })}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="mt-7">
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
        <Step state="next" title={t('onboarding:steps.in')} hint={t('onboarding:steps.inHint')} />
      </View>

      <View className="mt-8 gap-3">
        <Button
          label={t('onboarding:orInvite')}
          variant="gray"
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
  photoCard: {
    height: 168,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    backgroundColor: theme.color.bg.card,
  },
  photo: { width: '100%', height: '100%' },
  photoText: { position: 'absolute', left: 16, right: 16, bottom: 14, gap: 2 },
  photoSub: { color: 'rgba(255, 255, 255, 0.82)' },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepText: { paddingTop: 1 },
  dotWrap: { width: DOT, height: DOT, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: theme.color.bg.cardDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: theme.color.bg.ink },
  dotLive: {
    backgroundColor: theme.color.bg.canvas,
    borderWidth: 2,
    borderColor: theme.color.bg.ink,
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
  core: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.bg.ink },
  pulse: {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 2,
    borderColor: theme.color.bg.ink,
  },
  connector: {
    width: 2,
    height: 26,
    marginLeft: DOT / 2 - 1,
    marginVertical: 4,
    borderRadius: 1,
    backgroundColor: theme.color.bg.cardDeep,
  },
  connectorDone: { backgroundColor: theme.color.bg.ink },
});
