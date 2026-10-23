import { Pressable, View } from 'react-native';
import { cn } from './cn';
import { Text } from './Text';
import { theme } from './theme';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** Glass pill track with a white lifted pill on the chosen option. Two or three options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <View
      className={cn('flex-row rounded-full p-1', className)}
      style={{
        height: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.55)',
        borderWidth: 1.5,
        borderColor: theme.color.border.glass,
      }}
      accessibilityRole="tablist"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            className="flex-1 items-center justify-center rounded-full"
            style={on ? [{ backgroundColor: theme.color.bg.nested }, theme.shadow.lifted] : null}
          >
            <Text variant="bodyMedium" numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
