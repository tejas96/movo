import { photos, Screen, Text } from '@movo/design-system';
import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';

/** Photo with the logo mark on it, then title + subtitle above a form. */
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
      <View className="mt-2 h-[190px] overflow-hidden rounded-xl bg-card">
        <Image
          source={photos.auth}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        />
        <View className="m-3 h-14 w-14 items-center justify-center rounded-md bg-ink">
          <Text variant="h2" tone="inverse">
            M
          </Text>
        </View>
      </View>
      <View className="mb-6 mt-5 items-start">
        <Text variant="h1">{title}</Text>
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
