import { Canvas, Group, RoundedRect, vec } from '@shopify/react-native-skia';
import { type ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  interpolateColor,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme';

const EMPTY = 'rgba(43, 42, 46, 0.08)';
/** The month that is due now. */
const DUE = '#F5A3C7';

export interface DuesRingProps {
  /** Segments filled in orange (months paid). */
  filled: number;
  /** Segments in all. Default 12 (months). */
  total?: number;
  /** One segment shown pink: the month that is due. Default the one after the last filled. */
  dueIndex?: number | null;
  /** Width in dp. Default 240, as in the mockup. */
  width?: number;
  /** The amount and label in the middle. */
  children?: ReactNode;
  accessibilityLabel?: string;
}

/**
 * The half ring of rounded bars from the mockup's Maintenance card. Paid months fill in orange
 * one after another (0.7 s, then 80 ms apart); the due month is pink.
 */
export function DuesRing({
  filled,
  total = 12,
  dueIndex,
  width = 240,
  children,
  accessibilityLabel,
}: DuesRingProps) {
  // Mockup: viewBox 0 0 200 116 drawn at 240 × 140, the box is 240 × 130.
  const s = width / 200;
  const due = dueIndex === undefined ? (filled < total ? filled : null) : dueIndex;
  const step = 198 / (total - 1);
  return (
    <View
      style={{ width, height: Math.round(130 * (width / 240)) }}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
    >
      <Canvas style={{ position: 'absolute', left: 0, top: 0, width, height: 140 * (width / 240) }}>
        <Group transform={[{ scale: s }]}>
          {Array.from({ length: total }, (_, i) => {
            const angle = -99 + step * i;
            return (
              <Segment
                // Fixed count: the index is the segment.
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed list
                key={i}
                angle={angle}
                state={i < filled ? 'paid' : i === due ? 'due' : 'empty'}
                delay={700 + i * 80}
              />
            );
          })}
        </Group>
      </Canvas>
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

function Segment({
  angle,
  state,
  delay,
}: {
  angle: number;
  state: 'paid' | 'due' | 'empty';
  delay: number;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(state === 'paid' && reduced ? 1 : 0);
  useEffect(() => {
    if (state !== 'paid' || reduced) return;
    p.value = withDelay(delay, withTiming(1, { duration: 400, easing: Easing.ease }));
  }, [state, reduced, delay, p]);
  const color = useDerivedValue(() =>
    state === 'due'
      ? DUE
      : state === 'paid'
        ? interpolateColor(p.value, [0, 1], [EMPTY, theme.color.accent.fg])
        : EMPTY,
  );
  return (
    <Group transform={[{ rotate: (angle * Math.PI) / 180 }]} origin={vec(100, 104)}>
      <RoundedRect x={91} y={6} width={18} height={30} r={9} color={color} />
    </Group>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});
