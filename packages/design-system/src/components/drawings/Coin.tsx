import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { useLoop } from '../glow/motion';

/** The currency mark is part of the drawing, not a word, so it is not translated. */
const RUPEE = '₹';

export interface CoinProps {
  size?: number;
  /** `gold` shows ₹; `pale` is the smaller blank coin behind it. */
  tone?: 'gold' | 'pale';
  /** Start later so two coins do not move together. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The floating gold ₹ coin from the Money cards: it drifts up 8–10 dp and tilts ±10° every 3 s.
 * Decorative, so screen readers skip it.
 */
export function Coin({ size = 46, tone = 'gold', delay = 0, style }: CoinProps) {
  const gold = tone === 'gold';
  const p = useLoop(gold ? 1500 : 1300, delay);
  const animated = useAnimatedStyle(() =>
    gold
      ? { transform: [{ translateY: -10 * p.value }, { rotate: `${-10 + 20 * p.value}deg` }] }
      : { transform: [{ translateY: -6 * p.value }, { rotate: `${12 - 18 * p.value}deg` }] },
  );
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[{ width: size, height: size }, style, animated]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={10} fill={gold ? '#F6D35B' : '#FBE29A'} />
        <Circle
          cx={12}
          cy={12}
          r={7}
          fill="none"
          stroke="#B5501F"
          strokeWidth={0.8}
          strokeDasharray="2 2"
        />
        {gold ? (
          <SvgText
            x={12}
            y={15.5}
            textAnchor="middle"
            fontFamily="Poppins"
            fontWeight="600"
            fontSize={9}
            fill="#8A3E14"
          >
            {RUPEE}
          </SvgText>
        ) : null}
      </Svg>
    </Animated.View>
  );
}
