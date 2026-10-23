import {
  Backdrop,
  Building,
  Button,
  DotTexture,
  Glass,
  Icon,
  type IconName,
  Orb,
  Press,
  Strong,
  Text,
  theme,
} from '@movo/design-system';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StatusBar, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { markWelcomeSeen } from '../../core/auth/welcome-seen';
import { useNav } from '../../core/navigation/types';

type SlideKey = 'one' | 'two' | 'three';
const SLIDES: readonly SlideKey[] = ['one', 'two', 'three'];
const SLIDE_MS = 3400;
const BRAND = 'MOVO';
const RUPEE = '₹';

/**
 * First open, laid out like docs/design/soft-glow/source/Join.dc.html: the floating building
 * with four glass tags drifting around it, three lines that take turns, and the main button.
 * Shown once per device; Skip and both buttons mark it seen and replace the route.
 */
export function WelcomeScreen() {
  const { t } = useTranslation('auth');
  const nav = useNav();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), SLIDE_MS);
    return () => clearInterval(id);
  }, []);

  const leave = useCallback(
    (to: 'Login' | 'Register') => {
      markWelcomeSeen();
      nav.replace(to);
    },
    [nav],
  );

  const key = SLIDES[slide] ?? 'one';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <Backdrop scene="soft" />

      <View style={[styles.top, { top: insets.top + 14 }]}>
        <View style={styles.brandRow}>
          <Orb size={30} breathe={!reduced} />
          <Text style={styles.brand}>{BRAND}</Text>
        </View>
        <Press
          accessibilityRole="button"
          onPress={() => leave('Login')}
          hitSlop={8}
          scaleTo={0.95}
          style={styles.skip}
        >
          <Text variant="bodyMedium">{t('welcome.skip')}</Text>
        </Press>
      </View>

      {/* The scene: dots, the floating building and four tags around it. */}
      <View style={[styles.scene, { top: insets.top + 76 }]} pointerEvents="none">
        <DotTexture center={{ x: 0.5, y: 0.5 }} reach={0.65} />
        <View style={styles.building}>
          <Building width={220} />
        </View>
        <Tag
          style={{ left: 18, top: 40 }}
          delay={600}
          drift={0}
          icon={<TagIcon name="home" bg="#FDE6DA" color={theme.color.accent.fg} />}
          label={t('glow.tags.flat')}
        />
        <Tag
          style={{ right: 18, top: 92 }}
          delay={850}
          drift={1000}
          icon={
            <View style={[styles.tagIcon, { backgroundColor: '#E6F1E3' }]}>
              <View style={styles.greenDot} />
            </View>
          }
          label={t('glow.tags.events')}
        />
        <Tag
          style={{ left: 34, top: 296 }}
          delay={1100}
          drift={2000}
          icon={<TagIcon name="notices" bg="#EEE6FB" color="#7B5CC4" />}
          label={t('glow.tags.notices')}
        />
        <Tag
          style={{ right: 30, top: 262 }}
          delay={1300}
          drift={3000}
          icon={
            <View style={[styles.tagIcon, { backgroundColor: '#FDE6DA' }]}>
              <Text variant="caption" className="font-semibold" style={{ color: '#B5501F' }}>
                {RUPEE}
              </Text>
            </View>
          }
          label={t('glow.tags.dues')}
        />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 30 }]}>
        <Animated.View
          key={key}
          entering={reduced ? undefined : FadeInUp.duration(500)}
          style={styles.copy}
        >
          <Text style={styles.title}>
            {t(`glow.slides.${key}.a`)} <Strong>{t(`glow.slides.${key}.b`)}</Strong>
          </Text>
          <Text variant="body" tone="secondary" style={styles.body}>
            {t(`glow.slides.${key}.body`)}
          </Text>
        </Animated.View>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <Dot key={s} on={i === slide} />
          ))}
        </View>
        <Button size="xl" arrow sheen label={t('glow.cta')} onPress={() => leave('Register')} />
        <Pressable
          accessibilityRole="button"
          onPress={() => leave('Login')}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
        >
          <Text variant="bodyMedium" center style={styles.small}>
            {t('welcome.haveAccountShort')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function TagIcon({ name, bg, color }: { name: IconName; bg: string; color: string }) {
  return (
    <View style={[styles.tagIcon, { backgroundColor: bg }]}>
      <Icon name={name} size={15} color={color} />
    </View>
  );
}

/** A glass tag that pops in, then drifts up and down on its own beat. */
function Tag({
  style,
  delay,
  drift,
  icon,
  label,
}: {
  style: { left?: number; right?: number; top: number };
  delay: number;
  drift: number;
  icon: ReactNode;
  label: string;
}) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(reduced ? 1 : 0);
  const d = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    pop.value = withDelay(
      delay,
      withTiming(1, { duration: 600, easing: Easing.bezier(0.2, 1.4, 0.4, 1) }),
    );
    d.value = withDelay(
      drift,
      withRepeat(withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
  }, [reduced, delay, drift, pop, d]);
  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 1.4),
    transform: [{ scale: interpolate(pop.value, [0, 1], [0.6, 1]) }, { translateY: -8 * d.value }],
  }));
  return (
    <Animated.View style={[styles.tag, style, animated]}>
      <Glass radius={999} style={styles.tagGlass}>
        {icon}
        <Text variant="caption" className="font-medium" numberOfLines={1}>
          {label}
        </Text>
      </Glass>
    </Animated.View>
  );
}

function Dot({ on }: { on: boolean }) {
  const reduced = useReducedMotion();
  const w = useSharedValue(on ? 24 : 6);
  useEffect(() => {
    w.value = reduced
      ? on
        ? 24
        : 6
      : withTiming(on ? 24 : 6, { duration: 350, easing: Easing.bezier(0.2, 0.8, 0.2, 1) });
  }, [on, reduced, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: on ? theme.color.text.primary : 'rgba(43,42,46,0.2)' },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.color.bg.canvas },
  top: {
    position: 'absolute',
    left: 22,
    right: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 22,
    lineHeight: 30,
    color: theme.color.text.primary,
  },
  skip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  pressed: { opacity: 0.7 },
  scene: { position: 'absolute', left: 0, right: 0, height: 380 },
  building: { position: 'absolute', top: 70, left: 0, right: 0, alignItems: 'center' },
  tag: { position: 'absolute' },
  tagGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  tagIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4E9A55' },
  bottom: { position: 'absolute', left: 22, right: 22, bottom: 0, gap: 14 },
  copy: { gap: 8 },
  title: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: theme.color.text.primary,
  },
  body: { fontSize: 15, lineHeight: 22 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 6 },
  dot: { height: 6, borderRadius: 3 },
  textButton: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  small: { fontSize: 14 },
});
