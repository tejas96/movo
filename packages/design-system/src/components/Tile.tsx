import { type PressableProps, View } from 'react-native';
import type { IconName } from '../icons';
import type { TintName } from '../tokens';
import { cn } from './cn';
import { TintDisc } from './IconGrid';
import { Press } from './Press';
import { Text } from './Text';

export type TileProps = Omit<PressableProps, 'children' | 'style'> & {
  icon: IconName;
  label: string;
  hint?: string | undefined;
  /** Small black counter on the icon. */
  count?: number | undefined;
  /** Tint of the icon circle. Default peach. */
  tint?: TintName | string;
  className?: string;
};

/**
 * A glass tile with a tinted icon circle, a label and a gray hint (listing facts, stats).
 * For a grid of places to go, use IconGrid.
 */
export function Tile({ icon, label, hint, count, tint, className, ...rest }: TileProps) {
  return (
    <Press
      accessibilityRole="button"
      {...rest}
      className={cn(
        'flex-1 min-h-[96px] justify-between rounded-[24px] p-3.5 bg-card border-[1.5px] border-glass',
        className,
      )}
      scaleTo={0.96}
    >
      <TintDisc icon={icon} tint={tint} size={40} count={count} />
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
    </Press>
  );
}
