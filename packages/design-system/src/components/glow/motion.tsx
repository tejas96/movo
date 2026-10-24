import { type ReactNode, useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { loopMode, settleRepeats } from './motion-policy';

/** CSS `ease-in-out`, used by every looping motion in the mockup. */
export const easeInOut = Easing.bezier(0.42, 0, 0.58, 1);
/** Cards rising into place: `cubic-bezier(.2,.8,.2,1)`. */
export const easeRise = Easing.bezier(0.2, 0.8, 0.2, 1);

/**
 * A value that goes 0 → 1 → 0, `half` ms each way, eased like CSS `alternate` loops.
 * `animate` (see motion-policy): unset = play for about 4 s then rest at 0, true = for good,
 * false = still. Also still when the phone asks for less motion.
 */
export function useLoop(half: number, delay = 0, animate?: boolean): SharedValue<number> {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    const mode = loopMode({ animate, reduced });
    if (mode === 'off') {
      p.value = 0;
      return;
    }
    const repeats = mode === 'forever' ? -1 : settleRepeats(half, true);
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: half, easing: easeInOut }), repeats, true),
    );
    return () => cancelAnimation(p);
  }, [reduced, half, delay, animate, p]);
  return p;
}

/**
 * A value that goes 0 → 1 every `period` ms and starts again (pulses, ripples, sparks). Same
 * `animate` rule as useLoop; a settled cycle rests at 1, which every drawing draws as its rest
 * pose (or not at all).
 */
export function useCycle(
  period: number,
  delay = 0,
  easing = Easing.out(Easing.ease),
  animate?: boolean,
) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    const mode = loopMode({ animate, reduced });
    if (mode === 'off') {
      p.value = 0;
      return;
    }
    const repeats = mode === 'forever' ? -1 : settleRepeats(period, false);
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: period, easing }), repeats, false),
    );
    return () => cancelAnimation(p);
  }, [reduced, period, delay, easing, animate, p]);
  return p;
}

export type LoopKind = 'float' | 'bob' | 'breathe' | 'wobble' | 'sway';

const LOOPS: Record<LoopKind, { half: number }> = {
  /** Big drawings drifting up and down: 10 dp over 5 s. */
  float: { half: 2500 },
  /** Small icons and pins: 6 dp over 2.4 s. */
  bob: { half: 1200 },
  /** The orb: grows to 1.06 over 4.5 s. */
  breathe: { half: 2250 },
  /** Megaphone and bells: −8° to 10° over 1.8 s. */
  wobble: { half: 900 },
  /** Water drop: −3° to 3° over 3 s. */
  sway: { half: 1500 },
};

export interface LoopProps {
  kind: LoopKind;
  /** Distance in dp (float, bob), scale gain (breathe) or degrees (wobble, sway). */
  amount?: number;
  /** Override the speed: one full cycle in ms. */
  period?: number;
  delay?: number;
  /** Unset = play for about 4 s then rest; true = loop for good; false = still. */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

const DEFAULT_AMOUNT: Record<LoopKind, number> = {
  float: 10,
  bob: 6,
  breathe: 0.06,
  wobble: 9,
  sway: 3,
};

/** Wraps a drawing in one of the mockup's gentle loops. */
export function Loop({ kind, amount, period, delay = 0, animate, style, children }: LoopProps) {
  const half = period ? period / 2 : LOOPS[kind].half;
  const p = useLoop(half, delay, animate);
  const a = amount ?? DEFAULT_AMOUNT[kind];
  const animated = useAnimatedStyle(() => {
    switch (kind) {
      case 'float':
      case 'bob':
        return { transform: [{ translateY: -a * p.value }] };
      case 'breathe':
        return { transform: [{ scale: 1 + a * p.value }] };
      case 'wobble':
        return { transform: [{ rotate: `${-a + 2 * a * p.value}deg` }] };
      case 'sway':
        return { transform: [{ rotate: `${-a + 2 * a * p.value}deg` }] };
    }
  });
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

export interface RiseProps {
  /** Wait before rising, in ms. Use multiples of motion.stagger for a list. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
  children: ReactNode;
}

/** Fades in while moving up 22 dp, the way every card enters in the mockup. */
export function Rise({ delay = 0, style, children }: RiseProps) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    p.value = withDelay(delay, withTiming(1, { duration: 800, easing: easeRise }));
  }, [reduced, delay, p]);
  const animated = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: 22 * (1 - p.value) }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * Counts a number up from 0 with an ease-out, for amounts like ₹2,400.
 * Returns the final value straight away when the phone asks for less motion.
 */
export function useCountUp(target: number, { delay = 700, duration = 1300 } = {}) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const step = (t: number) => {
      if (start === null) start = t + delay;
      const k = Math.max(0, Math.min(1, (t - start) / duration));
      setValue(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduced, target, delay, duration]);
  return value;
}
