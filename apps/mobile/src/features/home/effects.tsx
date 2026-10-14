import { Text } from '@movo/design-system';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { money } from '../../core/util/money';

/** Sections fade and rise once, 50 ms apart, the first time Home mounts. */
export function Reveal({ order, children }: { order: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(360).delay(order * 50)}>{children}</Animated.View>
  );
}

/** Counts a rupee amount up from zero the first time it shows; later changes jump. */
export function CountUp({ paise }: { paise: number }) {
  const [shown, setShown] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) {
      setShown(paise);
      return;
    }
    done.current = true;
    const start = Date.now();
    const ms = 900;
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / ms);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(paise * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paise]);
  return (
    <Text variant="display" tone="inverse" style={styles.amount}>
      {money(shown)}
    </Text>
  );
}

/** Dark gradient over a photo so white text reads: `top` and `bottom` are opacities. */
export function PhotoScrim({ top, bottom }: { top: number; bottom: number }) {
  const id = `scrim-${top}-${bottom}`;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity={top} />
          <Stop offset="0.45" stopColor="#000" stopOpacity={(top + bottom) / 4} />
          <Stop offset="1" stopColor="#000" stopOpacity={bottom} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

/** Shared by the photo surfaces on Home: a full-bleed photo and dimmed white text on it. */
export const photoStyles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  dim: { color: 'rgba(255, 255, 255, 0.72)' },
});

const styles = StyleSheet.create({
  amount: { fontVariant: ['tabular-nums'] },
});
