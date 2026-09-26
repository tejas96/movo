import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StatusBar,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_BAR_KEYBOARD_HEIGHT } from './BottomBar';
import { cn } from './cn';
import { RevealFocusedContext } from './keyboard-reveal';
import { theme } from './theme';
import { useKeyboardHeight } from './useKeyboardHeight';

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
  const keyboard = useKeyboardHeight();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const keyboardRef = useRef(0);
  keyboardRef.current = keyboard;

  /** Scrolls just enough to show the focused field above the keyboard and the BottomBar. */
  const reveal = useCallback(() => {
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const kb = keyboardRef.current;
      if (!input || !kb || !scrollRef.current) return;
      input.measureInWindow((_x, y, _w, h) => {
        const limit =
          Dimensions.get('screen').height - kb - (bottomBar ? BOTTOM_BAR_KEYBOARD_HEIGHT : 0) - 16;
        if (y + h > limit)
          scrollRef.current?.scrollTo({ y: offset.current + (y + h - limit), animated: true });
      });
    }, 80);
  }, [bottomBar]);

  useEffect(() => {
    if (!scroll) return;
    const sub = Keyboard.addListener('keyboardDidShow', reveal);
    return () => sub.remove();
  }, [scroll, reveal]);
  const paddingBottom =
    (tabBar ? theme.layout.tabBar.height + theme.layout.tabBar.bottom + 24 : bottomBar ? 120 : 24) +
    insets.bottom;
  const bg = gray ? 'bg-card-alt' : 'bg-canvas';
  return (
    <KeyboardAvoidingView
      // Padding on both platforms: edge to edge, Android no longer resizes the window itself.
      behavior="padding"
      // The BottomBar rides on the keyboard, so leave room for it too, in the same step.
      keyboardVerticalOffset={bottomBar ? -BOTTOM_BAR_KEYBOARD_HEIGHT : 0}
      className={cn('flex-1', bg)}
      // The status bar area stays outside the scroll, so content never slides under the clock.
      style={{ paddingTop: insets.top }}
    >
      <StatusBar barStyle="dark-content" />
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          onScroll={(e) => {
            offset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={32}
          className={cn('flex-1', bg)}
          contentContainerStyle={{
            paddingTop: 8,
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
          <RevealFocusedContext.Provider value={reveal}>
            <View className={className}>{children}</View>
          </RevealFocusedContext.Provider>
        </ScrollView>
      ) : (
        <View
          className={cn('flex-1', className)}
          style={{
            paddingTop: 8,
            paddingHorizontal: bleed ? 0 : theme.layout.gutter,
            // The keyboard already covers the navigation bar area.
            paddingBottom: bottomBar || tabBar || keyboard > 0 ? 0 : insets.bottom,
          }}
        >
          {children}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
