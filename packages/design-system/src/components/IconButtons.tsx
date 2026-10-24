import { type PressableProps, View, type ViewStyle } from 'react-native';
import type { BoldIconName, IconName, IconStyle } from '../icons';
import { cn } from './cn';
import { Icon } from './Icon';
import { Press } from './Press';
import { theme } from './theme';

/** gray = glass, white = solid white with a soft shadow (the mockup's header buttons), ink = dark. */
type Tone = 'gray' | 'white' | 'ink';

const FILL: Record<Tone, ViewStyle> = {
  gray: {
    backgroundColor: theme.color.bg.card,
    borderWidth: 1.5,
    borderColor: theme.color.border.glass,
  },
  white: { backgroundColor: theme.color.bg.nested, ...theme.shadow.control },
  ink: { backgroundColor: theme.color.bg.ink },
};
const FG: Record<Tone, string> = {
  gray: theme.color.icon.primary,
  white: theme.color.icon.primary,
  ink: theme.color.icon.onInk,
};

/** Bold unless `variant="linear"`; a bold icon must be a BoldIconName. */
type SlotIcon = { icon: BoldIconName; variant?: IconStyle } | { icon: IconName; variant: 'linear' };

export type IconSquareProps = Omit<PressableProps, 'children' | 'style'> &
  SlotIcon & {
    tone?: Tone;
    /** 46 (default) for header actions, 44 for rows. */
    size?: 'md' | 'sm';
    /** Small orange dot for unread state. */
    dot?: boolean;
    /** Any other diameter (50 next to the search pill). */
    diameter?: number;
    className?: string;
  };

/**
 * Round header action (the name stays from the old square look).
 * Non-pressable when no onPress is given.
 */
export function IconSquare({
  icon,
  variant = 'linear',
  tone = 'white',
  size = 'md',
  dot,
  diameter,
  className,
  onPress,
  ...rest
}: IconSquareProps) {
  const d = diameter ?? (size === 'md' ? theme.layout.iconButton.md : theme.layout.iconButton.sm);
  const style: ViewStyle = { width: d, height: d, borderRadius: d / 2, ...FILL[tone] };
  const content = (
    <>
      <Icon name={icon as BoldIconName} variant={variant} size={20} color={FG[tone]} />
      {dot ? (
        <View
          className="absolute h-2 w-2 rounded-full"
          style={{ top: 11, right: 12, backgroundColor: theme.color.accent.fg }}
        />
      ) : null}
    </>
  );
  if (!onPress)
    return (
      <View className={cn('items-center justify-center', className)} style={style}>
        {content}
      </View>
    );
  return (
    <Press
      scaleTo={0.9}
      accessibilityRole="button"
      onPress={onPress}
      {...rest}
      style={style}
      className={cn('items-center justify-center', className)}
    >
      {content}
    </Press>
  );
}

export type CircleButtonProps = Omit<PressableProps, 'children' | 'style'> &
  SlotIcon & {
    tone?: Tone;
    size?: number;
    /** Orange icon on a white circle (call, the mockup's row actions). */
    accent?: boolean;
    className?: string;
  };

/** Round action: call, chat, favourite. */
export function CircleButton({
  icon,
  variant = 'bold',
  tone = 'ink',
  size = 44,
  accent,
  className,
  ...rest
}: CircleButtonProps) {
  const fill = accent ? FILL.white : FILL[tone];
  const fg = accent ? theme.color.accent.fg : FG[tone];
  return (
    <Press
      scaleTo={0.9}
      accessibilityRole="button"
      {...rest}
      style={{ width: size, height: size, borderRadius: size / 2, ...fill }}
      className={cn('items-center justify-center', className)}
    >
      <Icon
        name={icon as BoldIconName}
        variant={variant}
        size={Math.round(size * 0.4)}
        color={fg}
      />
    </Press>
  );
}
