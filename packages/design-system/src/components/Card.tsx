import type { ReactNode } from 'react';
import { Pressable, type PressableProps, View, type ViewProps } from 'react-native';
import type { IconName } from '../icons';
import { cn } from './cn';
import { Icon } from './Icon';
import { IconSquare } from './IconButtons';
import { Text } from './Text';
import { theme } from './theme';

export interface CardProps extends ViewProps {
  /** tight = a plain stack of gray rows on the white screen. No fill, no padding. */
  tight?: boolean;
  /** white card on a gray canvas. */
  white?: boolean;
  className?: string;
}

/** Soft gray card with 28 radius. The building block of every screen. */
export function Card({ tight, white, className, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      className={cn(
        'rounded-xl',
        tight ? null : white ? 'bg-card-nested p-5' : 'bg-card p-5',
        className,
      )}
    />
  );
}

export interface RowProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  subtitle?: string | undefined;
  /** Leading icon in a small gray square. */
  icon?: IconName;
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

/** Gray row on the white screen: white icon square, bold title, gray subtitle. 72 min height. */
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
        (icon ? <IconSquare icon={icon} size="sm" tone={onGray ? 'gray' : 'white'} /> : null)}
      <View className="flex-1 min-w-0">
        <Text variant="bodyMedium" className="font-semibold" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" tone="secondary" numberOfLines={2} className="mt-0.5">
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
    'flex-row items-center gap-3 rounded-lg py-3 pl-3 pr-4 min-h-[72px]',
    tone === 'danger' ? 'bg-danger-soft' : onGray ? 'bg-card-nested' : 'bg-card',
    className,
  );
  if (!onPress) return <View className={cls}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      {...rest}
      className={cn(cls, 'active:opacity-pressed')}
    >
      {body}
    </Pressable>
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
