import { type PressableProps, View } from 'react-native';
import type { IconName } from '../icons';
import { cn } from './cn';
import { Icon } from './Icon';
import { Press } from './Press';
import { Text } from './Text';
import { theme } from './theme';

export interface ChipProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  icon?: IconName;
  selected?: boolean;
  className?: string;
}

/** Glass chip, 40 high, white rim. Selected = solid white. */
export function Chip({ label, icon, selected, className, ...rest }: ChipProps) {
  return (
    <Press
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      {...rest}
      style={{
        height: theme.layout.chip.height,
        borderWidth: 1.5,
        borderColor: theme.color.border.glass,
        backgroundColor: selected ? theme.color.bg.nested : 'rgba(255, 255, 255, 0.3)',
      }}
      className={cn(
        'flex-row items-center rounded-full',
        icon ? 'pl-1 pr-4 gap-2' : 'px-4',
        className,
      )}
    >
      {icon ? (
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: theme.layout.chip.iconBox,
            height: theme.layout.chip.iconBox,
            backgroundColor: selected ? theme.color.accent.bg : theme.color.bg.nested,
          }}
        >
          <Icon
            name={icon}
            size={16}
            color={selected ? theme.color.accent.fg : theme.color.icon.primary}
          />
        </View>
      ) : null}
      <Text variant="bodyMedium" numberOfLines={1}>
        {label}
      </Text>
    </Press>
  );
}
