import { type ReactNode, useState } from 'react';
import { ActivityIndicator, type PressableProps, StyleSheet, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { IconName } from '../icons';
import { cn } from './cn';
import { ArrowCircle } from './glow/Glass';
import { useCycle } from './glow/motion';
import { Icon } from './Icon';
import { Press } from './Press';
import { Text } from './Text';
import { theme } from './theme';

/** dangerText = red words on no fill, for a destructive step that is not urgent (Leave). */
export type ButtonVariant = 'ink' | 'gray' | 'white' | 'ghost' | 'danger' | 'dangerText';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  /** Shrink to content instead of filling the row. */
  inline?: boolean;
  /**
   * Soft Glow main button: label on the left, a white circle with the orange arrow on the right.
   * Use on ink buttons that move the user on (Pay, Join, Log in).
   */
  arrow?: boolean;
  /** A soft light band sweeps across every 3.6 s (the front-door buttons: Log in, Join). */
  sheen?: boolean;
  className?: string;
  trailing?: ReactNode;
}

const BG: Record<ButtonVariant, string> = {
  ink: 'bg-ink active:bg-ink-pressed',
  gray: 'bg-card border-[1.5px] border-glass active:bg-card-deep',
  white: 'bg-card-nested active:bg-card-deep',
  ghost: 'bg-transparent active:bg-card',
  danger: 'bg-danger active:opacity-pressed',
  dangerText: 'bg-transparent active:bg-card',
};
const FG: Record<ButtonVariant, string> = {
  ink: theme.color.text.onInk,
  gray: theme.color.text.primary,
  white: theme.color.text.primary,
  ghost: theme.color.text.primary,
  danger: theme.color.text.onInk,
  dangerText: theme.color.status.danger.fg,
};
const HEIGHT: Record<ButtonSize, number> = {
  sm: theme.layout.control.sm,
  md: theme.layout.control.md,
  lg: theme.layout.control.lg,
  xl: theme.layout.control.xl,
};
const PAD: Record<ButtonSize, string> = {
  sm: 'px-4',
  md: 'px-5',
  lg: 'px-6',
  xl: 'px-[26px]',
};

export function Button({
  label,
  variant = 'ink',
  size = 'lg',
  icon,
  loading,
  inline,
  arrow,
  sheen,
  disabled,
  className,
  trailing,
  ...rest
}: ButtonProps) {
  const fg = FG[variant];
  const height = HEIGHT[size];
  const isDisabled = disabled || loading;
  return (
    <Press
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      disabled={isDisabled}
      {...rest}
      style={[{ height }, variant === 'white' ? theme.shadow.control : null]}
      className={cn(
        'flex-row items-center rounded-full',
        sheen && 'overflow-hidden',
        arrow ? 'justify-between pl-[22px] pr-1.5' : cn('justify-center', PAD[size]),
        BG[variant],
        !inline && 'w-full',
        isDisabled && 'opacity-disabled',
        className,
      )}
    >
      {sheen && !isDisabled ? <Sheen /> : null}
      {loading && !arrow ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View className="flex-row items-center gap-2 shrink">
          {icon ? <Icon name={icon} size={size === 'sm' ? 18 : 20} color={fg} /> : null}
          <Text
            variant="bodyMedium"
            numberOfLines={1}
            style={{ color: fg }}
            className={size === 'sm' ? 'text-caption' : size === 'md' ? undefined : 'text-[15px]'}
          >
            {label}
          </Text>
          {trailing}
        </View>
      )}
      {arrow ? (
        loading ? (
          <View
            className="items-center justify-center rounded-full bg-card-nested"
            style={{ width: height - 12, height: height - 12 }}
          >
            <ActivityIndicator color={theme.color.accent.fg} size="small" />
          </View>
        ) : (
          <ArrowCircle size={height - 12} />
        )
      ) : null}
    </Press>
  );
}

/** Mockup `sheen 3.6s`: a band 40% as wide as the button runs from -120% to 260% of its width. */
function Sheen() {
  const [w, setW] = useState(0);
  const p = useCycle(3600, 0, Easing.inOut(Easing.ease));
  const band = w * 0.4;
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(p.value, [0, 0.6, 1], [-1.2 * band, 2.6 * band, 2.6 * band]) },
    ],
  }));
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
    >
      {w > 0 ? (
        <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, width: band }, style]}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.14" />
                <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#sheen)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
