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

/** White search pill with a soft shadow, and a round white filter button next to it. */
export function SearchBar({
  onFilterPress,
  onPressOpen,
  className,
  value,
  onChangeText,
  ...rest
}: SearchBarProps) {
  const field = (
    <View
      className="flex-1 flex-row items-center gap-2.5 rounded-full bg-card-nested px-[18px]"
      style={[{ height: 50 }, theme.shadow.control]}
    >
      <Icon name="search" size={18} color={theme.color.text.secondary} />
      <TextInput
        editable={!onPressOpen}
        pointerEvents={onPressOpen ? 'none' : 'auto'}
        placeholderTextColor={theme.color.text.tertiary}
        selectionColor={theme.color.accent.fg}
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
          <Icon name="close" variant="bold" size={20} color={theme.color.text.tertiary} />
        </Pressable>
      ) : null}
    </View>
  );
  return (
    <View className={cn('flex-row items-center gap-2.5', className)}>
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
          tone="white"
          onPress={onFilterPress}
          diameter={50}
        />
      ) : null}
    </View>
  );
}
