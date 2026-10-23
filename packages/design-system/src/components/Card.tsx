import type { ReactNode } from 'react';
import { Pressable, type PressableProps, View, type ViewProps } from 'react-native';
import type { BoldIconName } from '../icons';
import { cn } from './cn';
import { Icon } from './Icon';
import { IconSquare } from './IconButtons';
import { Press } from './Press';
import { Text } from './Text';
import { theme } from './theme';

export interface CardProps extends ViewProps {
  /** tight = a plain stack of rows on the page. No fill, no padding. */
  tight?: boolean;
  /** Solid white card instead of glass. */
  white?: boolean;
  className?: string;
}

/** Frosted glass card with 30 radius. The building block of every screen. */
export function Card({ tight, white, className, style, ...rest }: CardProps) {
  if (tight) return <View {...rest} style={style} className={className} />;
  return (
    <View
      {...rest}
      style={[
        {
          borderRadius: theme.radius['2xl'],
          borderWidth: 1.5,
          borderColor: theme.color.border.glass,
          backgroundColor: white ? theme.color.bg.nested : theme.color.bg.card,
        },
        theme.shadow.glass,
        style,
      ]}
      className={cn('p-[18px]', className)}
    />
  );
}

/** Small capitals label above a list or inside a glass list (THIS WEEK, GENERAL). */
export function SectionLabel({ children, className }: { children: string; className?: string }) {
  return (
    <Text variant="section" tone="secondary" className={cn('px-3 pt-2.5 pb-1.5', className)}>
      {children}
    </Text>
  );
}

export interface RowProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  subtitle?: string | undefined;
  /** Leading icon in a small gray square. */
  icon?: BoldIconName;
  /** Any leading node instead of the icon square (avatar, date block). */
  leading?: ReactNode;
  /** Trailing node (amount, status pill). A chevron is shown when pressable and nothing else is given. */
  trailing?: ReactNode;
  /** The row sits inside a gray card, so it turns white. */
  onGray?: boolean;
  /** danger = soft red, for active emergency alerts. */
  tone?: 'default' | 'danger';
  className?: string;
}

/**
 * List row: round icon, medium title, gray subtitle. On the page it is a glass pill; inside a
 * glass card (`onGray`) it has no fill, as in the mockup's grouped lists.
 */
export function Row({
  title,
  subtitle,
  icon,
  leading,
  trailing,
  onGray,
  tone = 'default',
  onPress,
  className,
  ...rest
}: RowProps) {
  const body = (
    <>
      {leading ??
        (icon ? <IconSquare icon={icon} variant="linear" size="sm" tone="white" /> : null)}
      <View className="flex-1 min-w-0">
        <Text variant="title" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={2} className="mt-0.5">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <Icon name="chevronRight" size={20} color={theme.color.text.secondary} />
        ) : null)}
    </>
  );
  const cls = cn(
    'flex-row items-center gap-3 rounded-[22px] p-2.5 pr-3.5 min-h-[66px]',
    tone === 'danger'
      ? 'bg-danger-soft'
      : onGray
        ? 'bg-transparent'
        : 'bg-card border-[1.5px] border-glass',
    className,
  );
  if (!onPress) return <View className={cls}>{body}</View>;
  return (
    <Press
      accessibilityRole="button"
      onPress={onPress}
      {...rest}
      className={cn(cls, 'active:opacity-pressed')}
    >
      {body}
    </Press>
  );
}

export function Divider({ className }: { className?: string }) {
  return <View className={cn('h-px bg-divider my-4', className)} />;
}

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/** "Notices ........ See all" */
export function SectionHeader({ title, actionLabel, onAction, className }: SectionHeaderProps) {
  return (
    <View className={cn('flex-row items-end justify-between mt-6 mb-3', className)}>
      <Text variant="h2">{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text variant="body" tone="secondary">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
