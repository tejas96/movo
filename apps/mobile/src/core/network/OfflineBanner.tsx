import { Icon, Text, theme } from '@movo/design-system';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOffline } from './online';

/**
 * Wraps the screens. While there is no internet, a slim gray strip sits at the top under the
 * status bar and the screens move down below it: the strip takes the top safe area, so screens
 * get a top inset of 0 and their headers are never covered. It goes away when the network
 * returns (react-query refetches on its own then).
 */
export function OfflineFrame({ children }: { children: ReactNode }) {
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();
  // The same tree online and offline, so screens keep their state when the network changes.
  return (
    <View className="flex-1">
      {offline ? <OfflineBanner top={insets.top} /> : null}
      <SafeAreaInsetsContext.Provider value={offline ? { ...insets, top: 0 } : insets}>
        <View className="flex-1">{children}</View>
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

function OfflineBanner({ top }: { top: number }) {
  const { t } = useTranslation('common');
  return (
    <View
      className="flex-row items-center gap-2 bg-card px-5 pb-2"
      style={{ paddingTop: top + 8 }}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon name="internet" size={16} color={theme.color.icon.secondary} />
      <Text variant="caption" tone="secondary" className="flex-1">
        {t('states.offline')}
      </Text>
    </View>
  );
}
