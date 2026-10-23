import { type PressableProps, View } from 'react-native';
import type { BoldIconName, IconName, IconStyle } from '../icons';
import { cn } from './cn';
import { Icon } from './Icon';
import { Press } from './Press';
import { Text } from './Text';

/** The icon is bold unless `iconVariant="linear"`; a bold icon must be a BoldIconName. */
type TileIcon =
  | { icon: BoldIconName; iconVariant?: IconStyle }
  | { icon: IconName; iconVariant: 'linear' };

export type TileProps = Omit<PressableProps, 'children' | 'style'> &
  TileIcon & {
    label: string;
    hint?: string | undefined;
    /** Small black counter, top right. */
    count?: number | undefined;
    /** One shade deeper, for tiles inside a gray card. white for tiles inside a gray card that should pop. */
    tone?: 'gray' | 'deep' | 'white';
    className?: string;
  };

const TONE = {
  gray: 'bg-card border-[1.5px] border-glass',
  deep: 'bg-card-deep border-[1.5px] border-glass',
  white: 'bg-card-nested',
} as const;

/** Facility-style tile for the Society hub and stats. Put three in a row. */
export function Tile({
  icon,
  iconVariant = 'bold',
  label,
  hint,
  count,
  tone = 'gray',
  className,
  ...rest
}: TileProps) {
  return (
    <Press
      accessibilityRole="button"
      {...rest}
      className={cn(
        'flex-1 min-h-[96px] justify-between rounded-[24px] p-4',
        TONE[tone],
        className,
      )}
      scaleTo={0.96}
    >
      <Icon name={icon as BoldIconName} variant={iconVariant} size={24} />
      <View className="mt-3">
        <Text variant="caption" className="font-medium" numberOfLines={2}>
          {label}
        </Text>
        {hint ? (
          <Text variant="micro" tone="secondary" className="font-normal" numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {count ? (
        <View className="absolute right-3 top-3 h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1.5">
          <Text variant="micro" tone="inverse" className="text-[11px] leading-[14px]">
            {count > 99 ? '99+' : String(count)}
          </Text>
        </View>
      ) : null}
    </Press>
  );
}
