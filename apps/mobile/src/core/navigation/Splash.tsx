import { Text, theme, wordmark, wordmarkHeight } from '@movo/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * Boot progress the splash can show honestly.
 * 0 = restoring the session, 1 = session known and the society is loading, 2 = everything is ready.
 */
export type SplashStage = 0 | 1 | 2;

interface SplashProps {
  stage: SplashStage;
  /** Called once the exit fade has finished. Unmount the splash then. */
  onDone: () => void;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Wordmark width in dp. Everything else is derived from it. */
const WORD_WIDTH = 168;
const WORD_HEIGHT = wordmarkHeight(WORD_WIDTH);
/** Stroke width in wordmark units: about 1.2 dp at WORD_WIDTH. */
const STROKE = (1.2 * wordmark.width) / WORD_WIDTH;
const BAR_WIDTH = 120;

/** Timeline in ms. The letters draw one after another, overlapping, then fill. */
const DRAW_MS = 1400;
const FILL_AT = 1000;
const FILL_MS = 450;
const TAG_AT = 1250;
const TAG_MS = 500;
const BAR_AT = 1400;
/** The splash never leaves before this, so the drawing is always seen in full. */
const MIN_MS = 2500;
const EXIT_MS = 380;

const STANDARD = Easing.bezier(0.2, 0, 0, 1);
const STAGE_TARGET: Record<SplashStage, number> = { 0: 0.35, 1: 0.7, 2: 1 };
const LETTER_COUNT = wordmark.letters.length;
/** Each letter draws over this share of the total, starting LETTER_STEP after the one before. */
const LETTER_SPAN = 0.46;
const LETTER_STEP = (1 - LETTER_SPAN) / (LETTER_COUNT - 1);

/** Full-screen white splash: "movo" writes itself, fills in, then a thin line shows real boot progress. */
export function Splash({ stage, onDone }: SplashProps) {
  const { t } = useTranslation('common');
  const insets = useSafeAreaInsets();
  const draw = useSharedValue(0);
  const fill = useSharedValue(0);
  const tag = useSharedValue(0);
  const bar = useSharedValue(0);
  const exit = useSharedValue(1);
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    draw.value = withTiming(1, { duration: DRAW_MS, easing: STANDARD });
    fill.value = withDelay(
      FILL_AT,
      withTiming(1, { duration: FILL_MS, easing: Easing.out(Easing.quad) }),
    );
    tag.value = withDelay(TAG_AT, withTiming(1, { duration: TAG_MS, easing: STANDARD }));
    const timer = setTimeout(() => setMinElapsed(true), MIN_MS);
    return () => clearTimeout(timer);
  }, [draw, fill, tag]);

  // The bar follows the real boot stage. It waits for the fill so it never races the letters.
  useEffect(() => {
    bar.value = withDelay(
      BAR_AT,
      withTiming(STAGE_TARGET[stage], { duration: stage === 2 ? 450 : 1100, easing: STANDARD }),
    );
  }, [bar, stage]);

  useEffect(() => {
    if (stage !== 2 || !minElapsed) return;
    exit.value = withDelay(
      250,
      withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.quad) }, (finished) => {
        if (finished) scheduleOnRN(onDone);
      }),
    );
  }, [exit, stage, minElapsed, onDone]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: exit.value }));
  const tagStyle = useAnimatedStyle(() => ({
    opacity: tag.value,
    transform: [{ translateY: interpolate(tag.value, [0, 1], [8, 0]) }],
  }));
  const barStyle = useAnimatedStyle(() => ({ width: BAR_WIDTH * bar.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, rootStyle]}
      accessibilityLabel={t('app.name')}
    >
      <View style={styles.center}>
        <Svg
          width={WORD_WIDTH}
          height={WORD_HEIGHT}
          viewBox={`0 0 ${wordmark.width} ${wordmark.height}`}
        >
          {wordmark.letters.map((letter, i) => (
            <Letter
              // biome-ignore lint/suspicious/noArrayIndexKey: static letters, fixed order
              key={i}
              d={letter.d}
              length={letter.length}
              index={i}
              draw={draw}
              fill={fill}
            />
          ))}
        </Svg>
        <Animated.View style={tagStyle}>
          <Text variant="caption" tone="secondary" center>
            {t('app.tagline')}
          </Text>
        </Animated.View>
      </View>
      <View style={[styles.track, { bottom: insets.bottom + 56 }]}>
        <Animated.View style={[styles.fill, barStyle]} />
      </View>
    </Animated.View>
  );
}

function Letter({
  d,
  length,
  index,
  draw,
  fill,
}: {
  d: string;
  length: number;
  index: number;
  draw: SharedValue<number>;
  fill: SharedValue<number>;
}) {
  const start = index * LETTER_STEP;
  const animatedProps = useAnimatedProps(() => {
    const t = interpolate(draw.value, [start, start + LETTER_SPAN], [0, 1], Extrapolation.CLAMP);
    return {
      strokeDashoffset: length * (1 - t),
      fillOpacity: fill.value,
    };
  });
  return (
    <AnimatedPath
      d={d}
      fill={theme.color.text.primary}
      stroke={theme.color.text.primary}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={[length, length]}
      animatedProps={animatedProps}
    />
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: theme.color.bg.canvas, zIndex: 10, elevation: 10 },
  // Optical centre: the word sits a little above the true middle, the bar holds the bottom.
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 48, gap: 14 },
  track: {
    position: 'absolute',
    alignSelf: 'center',
    width: BAR_WIDTH,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.color.bg.cardDeep,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 2, backgroundColor: theme.color.bg.ink },
});
