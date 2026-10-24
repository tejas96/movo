import { Orb, Ripple, Text, theme } from '@movo/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const BOX = 210;
const ORB = 170;
const R = 100;
const LENGTH = 2 * Math.PI * R;
const HOLD_MS = 2000;

export interface HoldOrbProps {
  /** No alert type picked yet: holding does nothing and the hint turns red. */
  disabled?: boolean;
  loading?: boolean;
  /** Fires once, when the ring is full. */
  onConfirm: () => void;
  /** The line under the orb when nobody is holding it. */
  hint: string;
}

/**
 * The red hold-to-alert orb from the mockup's Emergency screen: two red pulses behind it, a
 * ring that fills over two seconds while the finger is down, and a countdown under it.
 * Letting go early empties the ring. Screen readers get a long-press action that confirms.
 */
export function HoldOrb({ disabled, loading, onConfirm, hint }: HoldOrbProps) {
  const { t } = useTranslation(['emergency']);
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const press = useSharedValue(1);
  const [holding, setHolding] = useState(false);
  const [left, setLeft] = useState(2);
  const [nudge, setNudge] = useState(false);
  const off = Boolean(disabled || loading);
  useEffect(() => {
    if (!disabled) setNudge(false);
  }, [disabled]);

  useEffect(() => () => cancelAnimation(p), [p]);

  // Countdown text: whole seconds left, from the ring's progress.
  useAnimatedReaction(
    () => Math.ceil((1 - p.value) * (HOLD_MS / 1000)),
    (s, prev) => {
      if (s !== prev) runOnJS(setLeft)(s);
    },
  );

  const done = () => {
    setHolding(false);
    press.value = withTiming(1, { duration: 200 });
    p.value = withTiming(0, { duration: 300 });
    onConfirm();
  };

  const start = () => {
    if (disabled) setNudge(true);
    if (off) return;
    setHolding(true);
    press.value = withTiming(0.94, { duration: 200 });
    p.value = 0;
    p.value = withTiming(1, { duration: HOLD_MS, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(done)();
    });
  };

  const stop = () => {
    if (!holding) return;
    setHolding(false);
    cancelAnimation(p);
    press.value = withTiming(1, { duration: 200 });
    p.value = withTiming(0, { duration: 250 });
  };

  const ring = useAnimatedProps(() => ({ strokeDashoffset: LENGTH * (1 - p.value) }));
  const squeeze = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  return (
    <View style={styles.wrap}>
      <View style={styles.box}>
        {!reduced ? (
          <View style={styles.pulses} pointerEvents="none">
            <Ripple
              size={ORB}
              color="#EE4B3F"
              from={0.35}
              to={1.6}
              period={2200}
              delay={0}
              animate
            />
            <Ripple
              size={ORB}
              color="#EE4B3F"
              from={0.35}
              to={1.6}
              period={2200}
              delay={1100}
              animate
            />
          </View>
        ) : null}
        <Svg width={BOX} height={BOX} style={styles.ring} pointerEvents="none">
          <Circle
            cx={BOX / 2}
            cy={BOX / 2}
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth={6}
          />
          <AnimatedCircle
            cx={BOX / 2}
            cy={BOX / 2}
            r={R}
            fill="none"
            stroke={theme.color.status.danger.fg}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${LENGTH} ${LENGTH}`}
            animatedProps={ring}
          />
        </Svg>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('emergency:hold')}
          accessibilityState={{ disabled: off, busy: Boolean(loading) }}
          accessibilityActions={[{ name: 'longpress' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'longpress' && !off) onConfirm();
          }}
          disabled={Boolean(loading)}
          onPressIn={start}
          onPressOut={stop}
          style={styles.press}
        >
          <Animated.View style={squeeze}>
            <Orb size={ORB} tone="alert" breathe={!holding}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.label}>
                  {holding ? t('emergency:glow.keep') : t('emergency:glow.hold')}
                </Text>
              )}
            </Orb>
          </Animated.View>
        </Pressable>
      </View>
      <Text variant="caption" tone={nudge ? 'danger' : 'secondary'} center>
        {holding ? t('emergency:glow.left', { count: left }) : hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14, paddingVertical: 6 },
  box: { width: BOX, height: BOX, alignItems: 'center', justifyContent: 'center' },
  pulses: { position: 'absolute', left: 20, top: 20, width: ORB, height: ORB },
  ring: { position: 'absolute', left: 0, top: 0, transform: [{ rotate: '-90deg' }] },
  press: { width: ORB, height: ORB, borderRadius: ORB / 2 },
  label: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 17,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 22,
  },
});
