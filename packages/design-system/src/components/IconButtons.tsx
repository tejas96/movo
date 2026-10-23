import { type PressableProps, View } from 'react-native';
import type { IconName, IconStyle } from '../icons';
import { cn } from './cn';
import { Icon } from './Icon';
import { Press } from './Press';
import { theme } from './theme';

type Tone = 'gray' | 'white' | 'ink';

const BG: Record<Tone, string> = {
  gray: 'bg-card active:bg-card-deep',
  white: 'bg-card-nested active:bg-card',
  ink: 'bg-ink active:bg-ink-pressed',
};
const FG: Record<Tone, string> = {
  gray: theme.color.icon.primary,
  white: theme.color.icon.primary,
  ink: theme.color.icon.onInk,
};

export interface IconSquareProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: IconName;
  variant?: IconStyle;
  tone?: Tone;
  /** 52 (default) for header actions, 44 for rows. */
  size?: 'md' | 'sm';
  /** Small black dot for unread state. */
  dot?: boolean;
  className?: string;
}

/** Rounded square, the reference's header action. Non-pressable when no onPress is given. */
export function IconSquare({
  icon,
  variant = 'bold',
  tone = 'gray',
  size = 'md',
  dot,
  className,
  onPress,
  ...rest
}: IconSquareProps) {
  const dims =
    size === 'md' ? 'w-icon-btn h-icon-btn rounded-md' : 'w-icon-btn-sm h-icon-btn-sm rounded-sm';
  const content = (
    <>
      <Icon name={icon} variant={variant} size={size === 'md' ? 24 : 22} color={FG[tone]} />
      {dot ? (
        <View className="absolute right-[13px] top-[13px] h-2 w-2 rounded-full bg-ink border-2 border-card" />
      ) : null}
    </>
  );
  if (!onPress)
    return (
      <View className={cn('items-center justify-center', dims, BG[tone].split(' ')[0], className)}>
        {content}
      </View>
    );
  return (
    <Press
      scaleTo={0.9}
      accessibilityRole="button"
      onPress={onPress}
      {...rest}
      className={cn('items-center justify-center', dims, BG[tone], className)}
    >
      {content}
    </Press>
  );
}

export interface CircleButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: IconName;
  variant?: IconStyle;
  tone?: Tone;
  size?: number;
  className?: string;
}

/** Round action: call, chat, favourite. */
export function CircleButton({
  icon,
  variant = 'bold',
  tone = 'ink',
  size = 44,
  className,
  ...rest
}: CircleButtonProps) {
  return (
    <Press
      scaleTo={0.9}
      accessibilityRole="button"
      {...rest}
      style={{ width: size, height: size }}
      className={cn('items-center justify-center rounded-full', BG[tone], className)}
    >
      <Icon name={icon} variant={variant} size={Math.round(size * 0.45)} color={FG[tone]} />
    </Press>
  );
}
