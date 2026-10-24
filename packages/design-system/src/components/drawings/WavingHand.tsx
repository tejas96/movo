import Animated, { Easing, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useCycle } from '../glow/motion';

/** The waving hand on Log in, mockup `wave 2.4s`: 0°, 16°, −8°, 14°, −4°, 0° from the wrist. */
export function WavingHand({ size = 64, delay = 600 }: { size?: number; delay?: number }) {
  const p = useCycle(2400, delay, Easing.inOut(Easing.ease));
  const animated = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(p.value, [0, 0.2, 0.4, 0.6, 0.8, 1], [0, 16, -8, 14, -4, 0])}deg`,
      },
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[{ width: size, height: size, transformOrigin: '70% 80%' }, animated]}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d="M7 11V6.5a1.5 1.5 0 013 0V10m0-4.5v-1a1.5 1.5 0 013 0V10m0-4a1.5 1.5 0 013 0v5m0-3a1.5 1.5 0 013 0V14a7 7 0 01-7 7h-1a6 6 0 01-5.2-3L4.3 13.8a1.5 1.5 0 012.6-1.5L7 12.5"
          fill="#FBD9C4"
          stroke="#2B2A2E"
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}
