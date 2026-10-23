import type { ReactNode } from 'react';
import { ActivityIndicator, type PressableProps, View } from 'react-native';
import type { IconName } from '../icons';
import { cn } from './cn';
import { ArrowCircle } from './glow/Glass';
import { Icon } from './Icon';
import { Press } from './Press';
import { Text } from './Text';
import { theme } from './theme';

export type ButtonVariant = 'ink' | 'gray' | 'white' | 'ghost' | 'danger';
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
  className?: string;
  trailing?: ReactNode;
}

const BG: Record<ButtonVariant, string> = {
  ink: 'bg-ink active:bg-ink-pressed',
  gray: 'bg-card border-[1.5px] border-glass active:bg-card-deep',
  white: 'bg-card-nested active:bg-card-deep',
  ghost: 'bg-transparent active:bg-card',
  danger: 'bg-danger active:opacity-pressed',
};
const FG: Record<ButtonVariant, string> = {
  ink: theme.color.text.onInk,
  gray: theme.color.text.primary,
  white: theme.color.text.primary,
  ghost: theme.color.text.primary,
  danger: theme.color.text.onInk,
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
        arrow ? 'justify-between pl-[22px] pr-1.5' : cn('justify-center', PAD[size]),
        BG[variant],
        !inline && 'w-full',
        isDisabled && 'opacity-disabled',
        className,
      )}
    >
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
