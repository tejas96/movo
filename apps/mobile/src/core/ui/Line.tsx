import { Text } from '@movo/design-system';
import { View } from 'react-native';

export function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text
        variant={strong ? 'bodyMedium' : 'body'}
        tone={strong ? 'primary' : 'secondary'}
        className="flex-1"
      >
        {label}
      </Text>
      <Text variant="bodyMedium" className={strong ? 'font-semibold' : undefined}>
        {value}
      </Text>
    </View>
  );
}
