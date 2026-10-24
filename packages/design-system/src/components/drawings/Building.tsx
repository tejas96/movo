import { BlurMask, Canvas, Group, Oval, Path } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import { Loop, useCycle, useLoop } from '../glow/motion';
import { Ripple } from '../glow/Orb';
import { Text } from '../Text';
import { theme } from '../theme';

/** Mockup colours: white roof, peach left face, clay right face, butter-yellow lit windows. */
const ROOF = '#FFFFFF';
const LEFT = '#F7C9B6';
const RIGHT = '#EBA48F';
const LIT = '#F6D35B';
const DARK = '#8C6B7A';

/** Window grid of one face, in the face's own flat coordinates (mockup viewBox 0 0 200 240). */
const COLS_LEFT = [8, 26, 44];
const COLS_RIGHT = [6, 24, 42];
const ROWS = [14, 36, 58, 80, 102];
/** Lit windows and their blink delay in s, as in the mockup: [col, row, delay]. */
const LIT_LEFT: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [0, 1, 2.5],
  [2, 2, 4],
  [1, 3, 0.4],
  [0, 4, 3.2],
];
const LIT_RIGHT: readonly (readonly [number, number, number])[] = [
  [2, 0, 1.8],
  [1, 1, 5],
  [0, 2, 2.2],
  [2, 3, 0.9],
  [1, 4, 3.7],
];

/** One window as a parallelogram on a skewed face: matrix(1, k, 0, 1, ox, oy). */
function windowPath(x: number, y: number, ox: number, oy: number, k: number) {
  const w = 10;
  const h = 13;
  const p = (px: number, py: number) => `${ox + px} ${oy + k * px + py}`;
  return `M${p(x, y)} L${p(x + w, y)} L${p(x + w, y + h)} L${p(x, y + h)} Z`;
}

export interface BuildingProps {
  /** Width in dp; the height follows the mockup's 200 × 240 drawing. */
  width?: number;
  /** Flat number on the pulsing pin; no pin when left out. */
  pin?: string;
  /** Float up and down with a breathing shadow. Default on. */
  floating?: boolean;
  /** Read out by screen readers, e.g. "Your building, Wing B". */
  accessibilityLabel?: string;
}

/**
 * The isometric society building from the mockup: three faces, windows that blink on their own
 * clocks, a soft shadow that breathes, and an optional flat pin that bobs and pings.
 */
export function Building({ width = 180, pin, floating = true, accessibilityLabel }: BuildingProps) {
  const s = width / 200;
  const height = Math.round(240 * s);
  const art = (
    <View style={{ width, height }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group transform={[{ scale: s }]}>
          <Path path="M100 20 L160 50 L100 80 L40 50 Z" color={ROOF} />
          <Path path="M40 50 L100 80 L100 220 L40 190 Z" color={LEFT} />
          <Path path="M100 80 L160 50 L160 190 L100 220 Z" color={RIGHT} />
          {ROWS.flatMap((y, r) =>
            COLS_LEFT.map((x, c) =>
              LIT_LEFT.some(([lc, lr]) => lc === c && lr === r) ? null : (
                <Path
                  key={`l${x}-${y}`}
                  path={windowPath(x, y, 40, 50, 0.5)}
                  color={DARK}
                  opacity={0.28}
                />
              ),
            ),
          )}
          {ROWS.flatMap((y, r) =>
            COLS_RIGHT.map((x, c) =>
              LIT_RIGHT.some(([lc, lr]) => lc === c && lr === r) ? null : (
                <Path
                  key={`r${x}-${y}`}
                  path={windowPath(x, y, 100, 80, -0.5)}
                  color={DARK}
                  opacity={0.28}
                />
              ),
            ),
          )}
          {LIT_LEFT.map(([c, r, d]) => (
            <LitWindow
              key={`ll${c}${r}`}
              path={windowPath(COLS_LEFT[c] ?? 0, ROWS[r] ?? 0, 40, 50, 0.5)}
              delay={d * 1000}
            />
          ))}
          {LIT_RIGHT.map(([c, r, d]) => (
            <LitWindow
              key={`rl${c}${r}`}
              path={windowPath(COLS_RIGHT[c] ?? 0, ROWS[r] ?? 0, 100, 80, -0.5)}
              delay={d * 1000}
            />
          ))}
        </Group>
      </Canvas>
      {pin ? <Pin label={pin} scale={width / 180} /> : null}
    </View>
  );
  return (
    <View
      style={{ width, height }}
      accessible={Boolean(accessibilityLabel)}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {floating ? <Shadow width={width} /> : null}
      {floating ? <Loop kind="float">{art}</Loop> : art}
    </View>
  );
}

/** A lit window that goes dark for a moment every 6 s (mockup `blink 6s`). */
function LitWindow({ path, delay }: { path: string; delay: number }) {
  const p = useCycle(6000, delay, Easing.linear);
  const color = useDerivedValue(() =>
    interpolateColor(p.value, [0, 0.45, 0.5, 0.55, 1], [LIT, LIT, DARK, LIT, LIT]),
  );
  return <Path path={path} color={color} />;
}

/** Soft plum shadow under the floating building; it shrinks as the building rises. */
function Shadow({ width }: { width: number }) {
  const p = useLoop(2500);
  const animated = useAnimatedStyle(() => ({
    opacity: 0.16 - 0.08 * p.value,
    transform: [{ scaleX: 1 - 0.2 * p.value }],
  }));
  const k = width / 180;
  const w = width * 0.69;
  const h = 20 * k;
  // Room around the oval for the blur to fade out.
  const pad = 24;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: (width - w) / 2 - pad,
          bottom: 8 * k - pad,
          width: w + pad * 2,
          height: h + pad * 2,
        },
        animated,
      ]}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <Oval x={pad} y={pad} width={w} height={h} color="#6B4A5A">
          <BlurMask blur={8} style="normal" />
        </Oval>
      </Canvas>
    </Animated.View>
  );
}

/** Ink pin with the flat number, bobbing, with an orange ping behind it. */
function Pin({ label, scale }: { label: string; scale: number }) {
  const size = Math.round(34 * scale);
  return (
    <View style={{ position: 'absolute', left: 46 * scale, top: 82 * scale }}>
      <Loop kind="bob" period={2400}>
        <View style={{ width: size, height: size }}>
          <Ripple size={size} color={theme.color.accent.fg} from={0.6} to={2.2} period={2000} />
          <View
            style={{
              ...StyleSheet.absoluteFill,
              borderRadius: size / 2,
              backgroundColor: theme.color.bg.ink,
              borderWidth: 3,
              borderColor: theme.color.bg.nested,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="micro" tone="inverse" style={{ fontSize: 10 * scale }} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </View>
      </Loop>
    </View>
  );
}
