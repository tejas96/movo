import { Pressable, TextInput, type TextInputProps, View } from 'react-native';
import { cn } from './cn';
import { Icon } from './Icon';
import { IconSquare } from './IconButtons';
import { theme } from './theme';

export interface SearchBarProps extends TextInputProps {
  onFilterPress?: () => void;
  /** Render as a button that opens a search screen. */
  onPressOpen?: () => void;
  className?: string;
}

/** Gray 56 pill with a search icon, and the black filter square next to it. */
export function SearchBar({
  onFilterPress,
  onPressOpen,
  className,
  value,
  onChangeText,
  ...rest
}: SearchBarProps) {
  const field = (
    <View className="h-control-lg flex-1 flex-row items-center gap-3 rounded-full bg-card px-5">
      <Icon name="search" size={22} color={theme.color.text.secondary} />
      <TextInput
        editable={!onPressOpen}
        pointerEvents={onPressOpen ? 'none' : 'auto'}
        placeholderTextColor={theme.color.text.secondary}
        selectionColor={theme.color.bg.ink}
        value={value}
        onChangeText={onChangeText}
        className="flex-1 font-sans text-body text-ink py-0"
        style={{ fontFamily: 'Poppins', fontWeight: '400', includeFontPadding: false }}
        returnKeyType="search"
        {...rest}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText?.('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear"
        >
          <Icon name="close" variant="bold" size={20} color={theme.color.text.secondary} />
        </Pressable>
      ) : null}
    </View>
  );
  return (
    <View className={cn('flex-row items-center gap-3', className)}>
      {onPressOpen ? (
        <Pressable onPress={onPressOpen} className="flex-1" accessibilityRole="search">
          {field}
        </Pressable>
      ) : (
        field
      )}
      {onFilterPress ? (
        <IconSquare
          icon="filter"
          variant="linear"
          tone="ink"
          onPress={onFilterPress}
          className="w-control-lg h-control-lg"
        />
      ) : null}
    </View>
  );
}
