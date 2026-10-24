import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import type { IconName } from '../../icons';
import { useCycle, useLoop } from '../glow/motion';
import { Icon } from '../Icon';
import { theme } from '../theme';

/**
 * How a small icon moves, from the mockup's notice rows:
 * bob = up and down 3 (lift), flick = squash like a flame (events), drive = side to side 2 (car),
 * wobble = tilt ±8° (megaphone), wiggle = tilt ±8° and lift 2 (open notice art).
 */
export type IconMotion = 'bob' | 'flick' | 'drive' | 'wobble' | 'wiggle' | 'still';

const PERIOD: Record<IconMotion, number> = {
  bob: 1800,
  flick: 1000,
  drive: 1400,
  wobble: 2000,
  wiggle: 2600,
  still: 1000,
};

export interface MovingIconProps {
  name: IconName;
  motion?: IconMotion;
  size?: number;
  color?: string;
}

/** An Iconsax outline icon that keeps moving gently. */
export function MovingIcon({
  name,
  motion = 'bob',
  size = 24,
  color = theme.color.icon.primary,
}: MovingIconProps) {
  return (
    <Moving motion={motion}>
      <Icon name={name} size={size} color={color} />
    </Moving>
  );
}

/** Wraps any small drawing in one of the icon motions. */
export function Moving({ motion, children }: { motion: IconMotion; children: ReactNode }) {
  const p = useCycle(PERIOD[motion], 0, Easing.inOut(Easing.ease));
  const animated = useAnimatedStyle(() => {
    const t = p.value;
    switch (motion) {
      case 'bob':
        return { transform: [{ translateY: interpolate(t, [0, 0.5, 1], [0, -3, 0]) }] };
      case 'flick':
        return {
          transform: [
            { scaleX: interpolate(t, [0, 0.5, 1], [1, 0.9, 1]) },
            { scaleY: interpolate(t, [0, 0.5, 1], [1, 1.1, 1]) },
          ],
        };
      case 'drive':
        return { transform: [{ translateX: interpolate(t, [0, 0.5, 1], [-2, 2, -2]) }] };
      case 'wobble':
        return { transform: [{ rotate: `${interpolate(t, [0, 0.5, 1], [-8, 8, -8])}deg` }] };
      case 'wiggle':
        return {
          transform: [
            { rotate: `${interpolate(t, [0, 0.25, 0.75, 1], [0, -8, 8, 0])}deg` },
            { translateY: interpolate(t, [0, 0.25, 0.75, 1], [0, -2, -2, 0]) },
          ],
        };
      case 'still':
        return {};
    }
  });
  const origin = motion === 'flick' ? '50% 80%' : motion === 'wobble' ? '30% 60%' : '50% 50%';
  return <Animated.View style={[{ transformOrigin: origin }, animated]}>{children}</Animated.View>;
}

/** The megaphone on the Home notices card: three-wave speaker that wobbles −8°…10° in 1.8 s. */
export function Megaphone({ size = 28, color = '#C2457A' }: { size?: number; color?: string }) {
  const p = useLoop(900);
  const animated = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-8 + 18 * p.value}deg` }],
  }));
  return (
    <Animated.View style={[{ transformOrigin: '30% 60%' }, animated]} pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 10v4h3l6 4V6L7 10z M17 9a4 4 0 010 6 M19.5 7a7 7 0 010 10"
          stroke={color}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

/** The bobbing white map pin with a soft shadow, from the Find my way tile. */
export function MapPin({ size = 40, dot = '#6C7FD8' }: { size?: number; dot?: string }) {
  const p = useLoop(1000);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * p.value }] }));
  const k = size / 40;
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          left: 10 * k,
          top: 30 * k,
          width: 20 * k,
          height: 6 * k,
          borderRadius: 999,
          backgroundColor: 'rgba(43, 42, 46, 0.18)',
        }}
      />
      <Animated.View style={animated}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" fill="#FFFFFF" />
          <Circle cx={12} cy={10} r={3} fill={dot} />
        </Svg>
      </Animated.View>
    </View>
  );
}
