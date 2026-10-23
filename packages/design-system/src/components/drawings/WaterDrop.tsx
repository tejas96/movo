import { StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useCycle, useLoop } from '../glow/motion';

export interface WaterDropProps {
  /** Width in dp; height is 132/104 of it. Default 104, as on the pinned notice. */
  width?: number;
  accessibilityLabel?: string;
}

/**
 * The pinned water notice drawing: a swaying drop, three small drops falling from it and two
 * ripples spreading below. Drawn on the mockup's 104 × 132 grid.
 */
export function WaterDrop({ width = 104, accessibilityLabel }: WaterDropProps) {
  const k = width / 104;
  const height = 132 * k;
  return (
    <View
      style={{ width, height }}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Drop width={width} height={height} />
      <Falling k={k} x={52} y={104} r={3} color="#6C8CE0" delay={0} />
      <Falling k={k} x={40} y={100} r={2.2} color="#8FA8E0" delay={500} />
      <Falling k={k} x={64} y={100} r={2.2} color="#8FA8E0" delay={1000} />
      <RippleRing k={k} delay={0} stroke={1.6} />
      <RippleRing k={k} delay={800} stroke={1.2} />
    </View>
  );
}

/** The drop sways ±3° every 3 s around its middle. */
function Drop({ width, height }: { width: number; height: number }) {
  const p = useLoop(1500);
  const animated = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-3 + 6 * p.value}deg` }],
  }));
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { transformOrigin: '50% 45%' }, animated]}
      pointerEvents="none"
    >
      <Svg width={width} height={height} viewBox="0 0 104 132">
        <Defs>
          <LinearGradient id="soft-glow-drop" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#C9D8FA" />
            <Stop offset="1" stopColor="#6C8CE0" />
          </LinearGradient>
        </Defs>
        <Path
          d="M52 6C52 6 84 46 84 66a32 32 0 01-64 0C20 46 52 6 52 6z"
          fill="url(#soft-glow-drop)"
        />
        <Path
          d="M38 58c-2 6-2 12 2 18"
          stroke="#FFFFFF"
          strokeWidth={4}
          strokeLinecap="round"
          fill="none"
          opacity={0.75}
        />
      </Svg>
    </Animated.View>
  );
}

/** One small drop: falls 46 on the grid in 1.6 s, fading in and out (mockup `fall`). */
function Falling({
  k,
  x,
  y,
  r,
  color,
  delay,
}: {
  k: number;
  x: number;
  y: number;
  r: number;
  color: string;
  delay: number;
}) {
  const p = useCycle(1600, delay, Easing.in(Easing.ease));
  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
    transform: [{ translateY: k * interpolate(p.value, [0, 1], [-6, 46]) }],
  }));
  const d = 2 * r * k;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: (x - r) * k,
          top: (y - r) * k,
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: color,
        },
        animated,
      ]}
    />
  );
}

/** A ripple at the foot: an ellipse 52 × 10 that grows from 0.3 to 1.4 and fades. */
function RippleRing({ k, delay, stroke }: { k: number; delay: number; stroke: number }) {
  const p = useCycle(1600, delay, Easing.out(Easing.ease));
  const animated = useAnimatedStyle(() => ({
    opacity: 0.8 * (1 - p.value),
    transform: [{ scale: 0.3 + 1.1 * p.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 26 * k,
          top: 121 * k,
          width: 52 * k,
          height: 10 * k,
          borderRadius: 999,
          borderWidth: stroke,
          borderColor: '#6C8CE0',
        },
        animated,
      ]}
    />
  );
}
