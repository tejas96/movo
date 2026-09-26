import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { theme } from './theme';

export interface BottomBarProps {
  label?: string;
  value?: string;
  /** Usually one Button with inline. */
  action: ReactNode;
}

/** White sticky bar: small label + big value on the left, the one black button on the right. */
export function BottomBar({ label, value, action }: BottomBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute left-0 right-0 bottom-0 flex-row items-center justify-between gap-4 bg-canvas px-5 pt-4"
      style={[{ paddingBottom: Math.max(insets.bottom, 16) + 8 }, theme.shadow.sheet]}
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
