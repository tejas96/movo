import { Pressable, type PressableProps, View } from 'react-native';
import type { IconName } from '../icons';
import { cn } from './cn';
import { Icon } from './Icon';
import { Text } from './Text';
import { theme } from './theme';

export interface ChipProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  icon?: IconName;
  selected?: boolean;
  className?: string;
}

/** Category chip: gray, 52 high, white icon box. Selected = black. */
export function Chip({ label, icon, selected, className, ...rest }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      {...rest}
      className={cn(
        'h-chip flex-row items-center rounded-md pr-5',
        icon ? 'pl-1.5 gap-3' : 'pl-5',
        selected ? 'bg-ink' : 'bg-card active:bg-card-deep',
        className,
      )}
    >
      {icon ? (
        <View
          className={cn(
            'h-chip-icon w-chip-icon items-center justify-center rounded-sm',
            selected ? 'bg-white/15' : 'bg-card-nested',
          )}
        >
          <Icon
            name={icon}
            size={22}
            color={selected ? theme.color.icon.onInk : theme.color.icon.primary}
          />
        </View>
      ) : null}
      <Text variant="bodyMedium" tone={selected ? 'inverse' : 'primary'}>
        {label}
      </Text>
    </Pressable>
  );
}
