import { Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { useCycle, useLoop } from '../glow/motion';

export interface DiyaProps {
  /** Width and height in dp. Default 170, as on the Event card. */
  size?: number;
  accessibilityLabel?: string;
}

/**
 * The Diwali lamp from the Event card: a flickering flame over a clay bowl, with a warm halo
 * that swells behind it. Drawn on the mockup's 200 × 200 grid.
 */
export function Diya({ size = 170, accessibilityLabel }: DiyaProps) {
  const k = size / 200;
  return (
    <View
      style={{ width: size, height: size }}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Halo size={160 * k} left={20 * k} top={4 * k} />
      <Svg width={size} height={size} viewBox="0 0 200 200" style={StyleSheet.absoluteFill}>
        <Path d="M40 132h120c0 30-27 50-60 50s-60-20-60-50z" fill="#EBA48F" />
        <Path d="M40 132h120" stroke="#C9705A" strokeWidth={6} strokeLinecap="round" />
        <SvgCircle cx={70} cy={152} r={4.5} fill="#FFFFFF" />
        <SvgCircle cx={100} cy={160} r={4.5} fill="#FFFFFF" />
        <SvgCircle cx={130} cy={152} r={4.5} fill="#FFFFFF" />
      </Svg>
      <Flame size={size} />
    </View>
  );
}

/** Flame flicker, mockup `flick 1.2s`: squash and stretch with a small tilt. */
function Flame({ size }: { size: number }) {
  const p = useCycle(1200, 0, Easing.linear);
  const animated = useAnimatedStyle(() => ({
    transform: [
      { scaleX: interpolate(p.value, [0, 0.25, 0.5, 0.75, 1], [1, 0.92, 1.05, 0.96, 1]) },
      { scaleY: interpolate(p.value, [0, 0.25, 0.5, 0.75, 1], [1, 1.08, 0.95, 1.06, 1]) },
      { rotate: `${interpolate(p.value, [0, 0.25, 0.5, 0.75, 1], [-2, 3, -3, 2, -2])}deg` },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      // The flame turns around its base: (100, 110) on the 200 grid.
      style={[StyleSheet.absoluteFill, { transformOrigin: '50% 55%' }, animated]}
    >
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Path d="M100 40c18 26 24 44 24 58a24 24 0 01-48 0c0-14 6-32 24-58z" fill="#F59A4A" />
        <Path d="M100 70c9 13 11 21 11 28a11 11 0 01-22 0c0-7 2-15 11-28z" fill="#FFF4DC" />
      </Svg>
    </Animated.View>
  );
}

/** Warm glow behind the flame, mockup `halo 2.4s`: opacity .55 → .9 and scale 1 → 1.15. */
function Halo({ size, left, top }: { size: number; left: number; top: number }) {
  const p = useLoop(1200);
  const animated = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.35 * p.value,
    transform: [{ scale: 1 + 0.15 * p.value }],
  }));
  const r = size / 2;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left, top, width: size, height: size }, animated]}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={r} cy={r} r={r}>
          <RadialGradient
            c={vec(r, r)}
            r={r}
            colors={['rgba(255,236,190,0.95)', 'rgba(255,236,190,0)']}
            positions={[0, 0.65]}
          />
        </Circle>
      </Canvas>
    </Animated.View>
  );
}
