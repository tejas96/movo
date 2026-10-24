import { Canvas, Circle, RadialGradient, Shadow, vec } from '@shopify/react-native-skia';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion } from 'react-native-reanimated';
import { orb } from '../../tokens/glow';
import { Loop, useCycle } from './motion';
import { loopRuns } from './motion-policy';

export interface OrbProps {
  size: number;
  /** `alert` = the red orb on the Emergency screen. */
  tone?: 'brand' | 'alert';
  /** Grows and shrinks slowly. Default off: it is a forever loop, so ask for it on purpose. */
  breathe?: boolean;
  /** Soft rings spreading out behind it. Default off, for the same reason. */
  ripple?: boolean;
  /** Text or an icon on the orb (initials on an avatar). */
  children?: ReactNode;
  style?: ViewStyle;
}

/**
 * The glossy coral orb, Soft Glow's mark: a radial gradient lit from the top left, an inner
 * shadow at the bottom right and a soft coloured shadow under it.
 */
export function Orb({
  size,
  tone = 'brand',
  breathe = false,
  ripple = false,
  children,
  style,
}: OrbProps) {
  const stops = tone === 'alert' ? orb.alert : orb.stops;
  const shadowColor = tone === 'alert' ? 'rgba(214, 59, 59, 0.38)' : orb.shadow;
  // Mockup shadows: 30 → 0 6px 14px, 64 → 0 14px 30px, 180 → 0 24px 50px.
  const dy = Math.round(4 + size * 0.11);
  const spread = Math.round(10 + size * 0.23);
  const r = size / 2;
  const c = vec(orb.center.x * size, orb.center.y * size);
  // CSS `circle at 34% 28%` reaches the farthest corner.
  const reach = Math.hypot((1 - orb.center.x) * size, (1 - orb.center.y) * size);
  const body = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        boxShadow: `0 ${dy}px ${spread}px ${shadowColor}`,
      }}
    >
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={r} cy={r} r={r}>
          <RadialGradient
            c={c}
            r={reach}
            colors={stops.map((s) => s.color)}
            positions={stops.map((s) => s.offset)}
          />
          <Shadow
            dx={-size * 0.094}
            dy={-size * 0.125}
            blur={size * 0.125}
            color="rgba(120, 20, 60, 0.22)"
            inner
          />
          <Shadow
            dx={size * 0.0625}
            dy={size * 0.094}
            blur={size * 0.08}
            color="rgba(255, 255, 255, 0.45)"
            inner
          />
        </Circle>
      </Canvas>
      {children ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          {children}
        </View>
      ) : null}
    </View>
  );
  return (
    <View style={[{ width: size, height: size }, style]}>
      {ripple ? (
        <>
          <Ripple size={size} color={stops[2]?.color ?? '#F0735A'} delay={0} animate />
          <Ripple size={size} color="#CDB2F0" delay={1500} animate />
        </>
      ) : null}
      {breathe ? (
        <Loop kind="breathe" period={4500} animate>
          {body}
        </Loop>
      ) : (
        body
      )}
    </View>
  );
}

/**
 * A disc that grows to 2.4x and fades, again and again (mockup: `ripple 3s`). Draws nothing
 * unless `animate`: a still ripple is invisible, and a running one redraws every frame.
 */
export function Ripple({
  size,
  color,
  delay = 0,
  to = 2.4,
  from = 0.4,
  period = 3000,
  animate = false,
}: {
  size: number;
  color: string;
  delay?: number;
  to?: number;
  from?: number;
  period?: number;
  animate?: boolean;
}) {
  const reduced = useReducedMotion();
  const runs = loopRuns({ animate, reduced });
  const p = useCycle(period, delay, undefined, runs);
  const animated = useAnimatedStyle(() => ({
    opacity: from * (1 - p.value),
    transform: [{ scale: 1 + (to - 1) * p.value }],
  }));
  if (!runs) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: size / 2, backgroundColor: color },
        animated,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
