import { Button, type PhotoName, photos, Text, Wordmark } from '@movo/design-system';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useNav } from '../../core/navigation/types';
import { markWelcomeSeen } from './welcome-seen';

type SlideKey = 'one' | 'two' | 'three';
const SLIDES: readonly { key: SlideKey; photo: PhotoName }[] = [
  { key: 'one', photo: 'auth' },
  { key: 'two', photo: 'society' },
  { key: 'three', photo: 'society2' },
];

/** How much wider the photo is than the page, so it can drift slower than the text. */
const PARALLAX = 0.12;
const WHITE = '#FFFFFF';
const WHITE_SOFT = 'rgba(255, 255, 255, 0.78)';
const WHITE_PILL = 'rgba(255, 255, 255, 0.18)';

/**
 * First open: three full-bleed photos, one line each, one white button.
 * Shown once per device; Skip and both buttons mark it seen and replace the route.
 */
export function WelcomeScreen() {
  const { t } = useTranslation('auth');
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  const leave = useCallback(
    (to: 'Login' | 'Register') => {
      markWelcomeSeen();
      nav.replace(to);
    },
    [nav],
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <Animated.ScrollView
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={StyleSheet.absoluteFill}
      >
        {SLIDES.map((slide, i) => (
          <Slide
            key={slide.key}
            index={i}
            width={width}
            height={height}
            photo={slide.photo}
            title={t(`welcome.slides.${slide.key}.title`)}
            body={t(`welcome.slides.${slide.key}.body`)}
            scrollX={scrollX}
            bottom={insets.bottom + 196}
          />
        ))}
      </Animated.ScrollView>

      {/* Fixed chrome over the pages: wordmark, skip, dots, buttons. */}
      <View style={[styles.top, { top: insets.top + 16 }]} pointerEvents="box-none">
        <Wordmark width={92} color={WHITE} />
        <Pressable
          accessibilityRole="button"
          onPress={() => leave('Login')}
          hitSlop={8}
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
        >
          <Text variant="label" tone="inverse" className="font-medium">
            {t('welcome.skip')}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <Dot key={slide.key} index={i} width={width} scrollX={scrollX} />
          ))}
        </View>
        <Button label={t('welcome.getStarted')} variant="white" onPress={() => leave('Register')} />
        <Pressable
          accessibilityRole="button"
          onPress={() => leave('Login')}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
        >
          <Text variant="bodyMedium" center style={{ color: WHITE_SOFT }}>
            {t('welcome.haveAccountShort')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Slide({
  index,
  width,
  height,
  photo,
  title,
  body,
  scrollX,
  bottom,
}: {
  index: number;
  width: number;
  height: number;
  photo: PhotoName;
  title: string;
  body: string;
  scrollX: SharedValue<number>;
  /** Where the text block ends: above the fixed dots and buttons. */
  bottom: number;
}) {
  const range = [(index - 1) * width, index * width, (index + 1) * width];
  const photoStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          range,
          [-PARALLAX * width, 0, PARALLAX * width],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollX.value, range, [10, 0, 10], Extrapolation.CLAMP) },
    ],
  }));
  const photoWidth = width * (1 + 2 * PARALLAX);
  return (
    <View style={[styles.page, { width, height }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { left: -PARALLAX * width, width: photoWidth },
          photoStyle,
        ]}
      >
        <Image source={photos[photo]} resizeMode="cover" style={styles.photo} />
      </Animated.View>
      <Scrim />
      <Animated.View style={[styles.copy, { bottom }, textStyle]}>
        <Text variant="h1" tone="inverse" style={styles.title}>
          {title}
        </Text>
        <Text variant="body" style={{ color: WHITE_SOFT }}>
          {body}
        </Text>
      </Animated.View>
    </View>
  );
}

/** Dark gradient so white text reads on any photo: light at the top, deep at the bottom. */
function Scrim() {
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#000" stopOpacity="0.18" />
          <Stop offset="0.35" stopColor="#000" stopOpacity="0" />
          <Stop offset="0.68" stopColor="#000" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.88" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#scrim)" />
    </Svg>
  );
}

function Dot({
  index,
  width,
  scrollX,
}: {
  index: number;
  width: number;
  scrollX: SharedValue<number>;
}) {
  const range = [(index - 1) * width, index * width, (index + 1) * width];
  const style = useAnimatedStyle(() => ({
    width: interpolate(scrollX.value, range, [6, 22, 6], Extrapolation.CLAMP),
    opacity: interpolate(scrollX.value, range, [0.4, 1, 0.4], Extrapolation.CLAMP),
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111111' },
  page: { overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  copy: { position: 'absolute', left: 22, right: 22, gap: 8 },
  title: { fontSize: 28, lineHeight: 36 },
  top: {
    position: 'absolute',
    left: 22,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: WHITE_PILL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottom: { position: 'absolute', left: 22, right: 22, bottom: 0, gap: 12 },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  dot: { height: 6, borderRadius: 3, backgroundColor: WHITE },
  textButton: { height: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
});
