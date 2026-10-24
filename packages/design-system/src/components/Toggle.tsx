import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { theme } from './theme';

export interface ToggleProps {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

const OFF = 'rgba(43,42,46,0.18)';

/**
 * The Soft Glow switch from the mockup: a 50 × 30 track, orange when on, with a white knob that
 * slides with a small overshoot (cubic-bezier(.3, 1.5, .5, 1), 0.3 s).
 */
export function Toggle({ value, onValueChange, disabled, accessibilityLabel }: ToggleProps) {
  const reduced = useReducedMotion();
  const p = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    const to = value ? 1 : 0;
    p.value = reduced
      ? to
      : withTiming(to, { duration: 300, easing: Easing.bezier(0.3, 1.5, 0.5, 1) });
  }, [value, reduced, p]);
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      Math.min(1, Math.max(0, p.value)),
      [0, 1],
      [OFF, theme.color.accent.fg],
    ),
  }));
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: 20 * p.value }] }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange?.(!value)}
      style={disabled ? styles.disabled : undefined}
    >
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 50, height: 30, borderRadius: 15 },
  knob: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
  },
  disabled: { opacity: 0.4 },
});
