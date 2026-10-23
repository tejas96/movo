import type { ReactNode } from 'react';
import { ActivityIndicator, type PressableProps, View } from 'react-native';
import type { IconName } from '../icons';
import { cn } from './cn';
import { Icon } from './Icon';
import { Press } from './Press';
import { Text } from './Text';
import { theme } from './theme';

export type ButtonVariant = 'ink' | 'gray' | 'white' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  loading?: boolean;
  /** Shrink to content instead of filling the row. */
  inline?: boolean;
  className?: string;
  trailing?: ReactNode;
}

const BG: Record<ButtonVariant, string> = {
  ink: 'bg-ink active:bg-ink-pressed',
  gray: 'bg-card active:bg-card-deep',
  white: 'bg-card-nested active:bg-card',
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
const SIZE: Record<ButtonSize, string> = {
  sm: 'h-control-sm px-[18px]',
  md: 'h-control-md px-6',
  lg: 'h-control-lg px-7',
};

export function Button({
  label,
  variant = 'ink',
  size = 'md',
  icon,
  loading,
  inline,
  disabled,
  className,
  trailing,
  ...rest
}: ButtonProps) {
  const fg = FG[variant];
  const isDisabled = disabled || loading;
  return (
    <Press
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      disabled={isDisabled}
      {...rest}
      className={cn(
        'flex-row items-center justify-center rounded-full',
        BG[variant],
        SIZE[size],
        !inline && 'w-full',
        isDisabled && 'opacity-disabled',
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon ? <Icon name={icon} size={size === 'sm' ? 18 : 20} color={fg} /> : null}
          <Text
            variant="bodyMedium"
            style={{ color: fg }}
            className={size === 'sm' ? 'text-caption' : undefined}
          >
            {label}
          </Text>
          {trailing}
        </View>
      )}
    </Press>
  );
}
