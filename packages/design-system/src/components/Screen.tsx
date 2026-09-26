import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from './cn';
import { theme } from './theme';

export interface ScreenProps {
  children: ReactNode;
  /** Scroll the content. Off for screens that own a list. */
  scroll?: boolean;
  /** Extra bottom space when a floating tab bar covers the end of the content. */
  tabBar?: boolean;
  /** Extra bottom space when a BottomBar is rendered. */
  bottomBar?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** No horizontal gutter, for full-bleed lists. */
  bleed?: boolean;
  gray?: boolean;
  className?: string;
}

/** White canvas, safe area, 20 gutter. Every screen starts here. */
export function Screen({
  children,
  scroll = true,
  tabBar,
  bottomBar,
  refreshing,
  onRefresh,
  bleed,
  gray,
  className,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const paddingBottom =
    (tabBar ? theme.layout.tabBar.height + theme.layout.tabBar.bottom + 24 : bottomBar ? 120 : 24) +
    insets.bottom;
  const bg = gray ? 'bg-card-alt' : 'bg-canvas';
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className={cn('flex-1', bg)}
    >
      <StatusBar barStyle="dark-content" />
      {scroll ? (
        <ScrollView
          className={cn('flex-1', bg)}
          contentContainerStyle={{
            paddingTop: insets.top + 8,
            paddingBottom,
            paddingHorizontal: bleed ? 0 : theme.layout.gutter,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={Boolean(refreshing)}
                onRefresh={onRefresh}
                tintColor={theme.color.bg.ink}
              />
            ) : undefined
          }
        >
          <View className={className}>{children}</View>
        </ScrollView>
      ) : (
        <View
          className={cn('flex-1', className)}
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: bleed ? 0 : theme.layout.gutter,
            paddingBottom: bottomBar || tabBar ? 0 : insets.bottom,
          }}
        >
          {children}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
