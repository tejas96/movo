import { StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import { useCycle } from '../glow/motion';

export interface Spark {
  /** Start point, 0..100 of the box. */
  x: number;
  y: number;
  size: number;
  color: string;
  /** One rise in ms. */
  period: number;
  delay: number;
}

/** The mockup's Diwali sparks: small dots that fade in, rise 110 dp and fade out. */
export const DIYA_SPARKS: readonly Spark[] = [
  { x: 46, y: 60, size: 6, color: '#FFFFFF', period: 2400, delay: 0 },
  { x: 56, y: 62, size: 5, color: '#FFF3C4', period: 2800, delay: 600 },
  { x: 40, y: 66, size: 5, color: '#FFFFFF', period: 2200, delay: 1200 },
  { x: 62, y: 58, size: 4, color: '#FFF3C4', period: 3000, delay: 1800 },
];

export interface SparksProps {
  sparks?: readonly Spark[];
  /** How far a spark rises, in dp. Default 110. */
  rise?: number;
}

/** Rising sparks over a card. Fill the parent; decorative only. */
export function Sparks({ sparks = DIYA_SPARKS, rise = 110 }: SparksProps) {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {sparks.map((s) => (
        <SparkDot key={`${s.x}-${s.y}-${s.delay}`} spark={s} rise={rise} />
      ))}
    </View>
  );
}

function SparkDot({ spark, rise }: { spark: Spark; rise: number }) {
  const p = useCycle(spark.period, spark.delay, Easing.out(Easing.ease));
  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.3, 1], [0, 1, 0]),
    transform: [{ translateY: -rise * p.value }, { scale: interpolate(p.value, [0, 1], [0.4, 1]) }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${spark.x}%`,
          top: `${spark.y}%`,
          width: spark.size,
          height: spark.size,
          borderRadius: spark.size / 2,
          backgroundColor: spark.color,
        },
        animated,
      ]}
    />
  );
}
