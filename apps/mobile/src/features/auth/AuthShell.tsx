import { IconSquare, photos, Text, theme, Wordmark } from '@movo/design-system';
import { type ReactNode, useCallback, useEffect, useRef } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  type ScrollViewInstance,
  StatusBar,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  /** Back square on the photo, for screens reached from Login. */
  onBack?: () => void;
  children: ReactNode;
  /** Pinned under the form, above the home indicator. */
  footer?: ReactNode;
}

/** Share of the screen the photo takes while the keyboard is closed. */
const HERO_SHARE = 0.4;
/** The sheet's top corners overlap the photo by this much. */
const OVERLAP = 30;
const WHITE = '#FFFFFF';

/**
 * The front door: a photo fills the top, a white sheet with big round corners slides over it
 * and holds the form. When the keyboard opens the photo shrinks to a thin band and the sheet
 * takes the room, so the fields never hide behind the keyboard.
 */
export function AuthShell({ title, subtitle, onBack, children, footer }: AuthShellProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const full = Math.max(220, Math.round(screenHeight * HERO_SHARE));
  const compact = insets.top + 76;
  const hero = useSharedValue(full);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);

  // Scroll just enough to show the focused field above the keyboard.
  const reveal = useCallback((keyboardTop: number) => {
    setTimeout(() => {
      const input = TextInput.State.currentlyFocusedInput();
      if (!input || !scrollRef.current) return;
      input.measureInWindow((_x, y, _w, h) => {
        const limit = keyboardTop - 16;
        if (y + h > limit)
          scrollRef.current?.scrollTo({ y: offset.current + (y + h - limit), animated: true });
      });
    }, 300);
  }, []);

  useEffect(() => {
    const ease = { duration: 280, easing: Easing.bezier(0.2, 0, 0, 1) };
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      hero.value = withTiming(compact, ease);
      reveal(e.endCoordinates.screenY);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      hero.value = withTiming(full, ease);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [hero, full, compact, reveal]);

  const heroStyle = useAnimatedStyle(() => ({ height: hero.value }));

  return (
    <View className="flex-1 bg-ink">
      <StatusBar barStyle="light-content" />
      <Animated.View style={[styles.hero, heroStyle]}>
        <Image
          source={photos.auth}
          resizeMode="cover"
          style={[StyleSheet.absoluteFill, styles.photo]}
        />
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id="authScrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000" stopOpacity="0.32" />
              <Stop offset="0.6" stopColor="#000" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#authScrim)" />
        </Svg>
        <View style={[styles.heroBar, { top: insets.top + 16 }]} pointerEvents="box-none">
          {onBack ? (
            <IconSquare icon="back" variant="linear" tone="white" onPress={onBack} />
          ) : null}
          <Wordmark width={92} color={WHITE} />
        </View>
      </Animated.View>

      <KeyboardAvoidingView behavior="padding" style={styles.sheetWrap}>
        <View className="flex-1 rounded-t-[30px] bg-canvas">
          <ScrollView
            ref={scrollRef}
            onScroll={(e) => {
              offset.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={32}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, 16) + 12 },
            ]}
          >
            <View className="mb-6">
              <Text variant="h1">{title}</Text>
              {subtitle ? (
                <Text variant="body" tone="secondary" className="mt-1">
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {children}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: 'hidden', backgroundColor: theme.color.bg.ink },
  photo: { width: '100%', height: '100%' },
  heroBar: {
    position: 'absolute',
    left: 20,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetWrap: { flex: 1, marginTop: -OVERLAP },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.layout.gutter,
    paddingTop: 28,
  },
  footer: { marginTop: 'auto', paddingTop: 28, alignItems: 'center', gap: 6 },
});
