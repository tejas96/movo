import { Screen, Text } from '@movo/design-system';
import type { ReactNode } from 'react';
import { View } from 'react-native';

/** Logo mark + title + subtitle above a form. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Screen>
      <View className="mb-8 mt-6 items-start">
        <View className="h-14 w-14 items-center justify-center rounded-md bg-ink">
          <Text variant="h2" tone="inverse">
            M
          </Text>
        </View>
        <Text variant="h1" className="mt-6">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" tone="secondary" className="mt-1">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children}
    </Screen>
  );
}
