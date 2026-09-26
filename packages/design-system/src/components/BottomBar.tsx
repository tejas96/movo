import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { theme } from './theme';
import { useKeyboardHeight } from './useKeyboardHeight';

/** Height of the bar while the keyboard is open: 16 top + 52 button + 16 bottom. Screen keeps this free. */
export const BOTTOM_BAR_KEYBOARD_HEIGHT = 84;

export interface BottomBarProps {
  label?: string;
  value?: string;
  /** Usually one Button with inline. */
  action: ReactNode;
}

/** White sticky bar: small label + big value on the left, the one black button on the right. */
export function BottomBar({ label, value, action }: BottomBarProps) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  return (
    <View
      className="absolute left-0 right-0 bottom-0 flex-row items-center justify-between gap-4 bg-canvas px-5 pt-4"
      style={[
        // Sits on top of the keyboard while it is open.
        keyboard > 0
          ? { bottom: keyboard, paddingBottom: 16 }
          : { paddingBottom: Math.max(insets.bottom, 16) + 8 },
        theme.shadow.sheet,
      ]}
    >
      <View className="flex-1 min-w-0">
        {label ? (
          <Text variant="label" tone="secondary">
            {label}
          </Text>
        ) : null}
        {value ? (
          <Text variant="h1" numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}
