import { View, type ViewProps } from 'react-native';
import type { IconName, IconStyle } from '../icons';
import { cn } from './cn';
import { Icon } from './Icon';
import { Text } from './Text';
import { type StatusTone, theme } from './theme';

export interface PillProps extends ViewProps {
  label: string;
  icon?: IconName;
  iconVariant?: IconStyle;
  /** white = inside a gray card (default). gray = on white. overlay = over a photo. */
  tone?: 'white' | 'gray' | 'overlay';
  size?: 'md' | 'sm';
  className?: string;
}

const TONE: Record<NonNullable<PillProps['tone']>, string> = {
  white: 'bg-card-nested',
  gray: 'bg-card',
  overlay: 'bg-overlay',
};

/** Info pill: bed 4, rating 4.5, due 10 Oct. */
export function Pill({
  label,
  icon,
  iconVariant = 'bold',
  tone = 'white',
  size = 'md',
  className,
  ...rest
}: PillProps) {
  return (
    <View
      {...rest}
      className={cn(
        'flex-row items-center self-start rounded-full',
        size === 'md' ? 'h-pill px-3.5 gap-2' : 'h-pill-sm px-3 gap-1.5',
        TONE[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} variant={iconVariant} size={size === 'md' ? 18 : 16} /> : null}
      <Text
        variant={size === 'md' ? 'bodyMedium' : 'caption'}
        className={size === 'sm' ? 'font-medium' : undefined}
      >
        {label}
      </Text>
    </View>
  );
}

export interface StatusPillProps extends ViewProps {
  label: string;
  tone: StatusTone;
  dot?: boolean;
  className?: string;
}

const STATUS_BG: Record<StatusTone, string> = {
  success: 'bg-success-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  info: 'bg-info-soft',
  neutral: 'bg-neutral-soft',
  ink: 'bg-ink',
};
const STATUS_FG: Record<StatusTone, string> = {
  success: theme.color.status.success.fg,
  warning: theme.color.status.warning.fg,
  danger: theme.color.status.danger.fg,
  info: theme.color.status.info.fg,
  neutral: theme.color.status.neutral.fg,
  ink: theme.color.text.onInk,
};

/** Small soft pill for Paid, Pending, Overdue. The only place colour appears. */
export function StatusPill({ label, tone, dot, className, ...rest }: StatusPillProps) {
  const fg = STATUS_FG[tone];
  return (
    <View
      {...rest}
      className={cn(
        'h-[26px] flex-row items-center self-start rounded-full px-2.5 gap-1.5',
        STATUS_BG[tone],
        className,
      )}
    >
      {dot ? <View style={{ backgroundColor: fg }} className="h-1.5 w-1.5 rounded-full" /> : null}
      <Text variant="micro" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}
