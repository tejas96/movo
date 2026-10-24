import {
  Blur,
  Canvas,
  Group,
  LinearGradient,
  Paint,
  RadialGradient,
  Rect,
  vec,
} from '@shopify/react-native-skia';
import { type ReactNode, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View, type ViewProps } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';
import { blur as blurToken } from '../../tokens/effects';
import { type ArtName, type ArtPreset, type ArtSpot, art as presets } from '../../tokens/glow';
import { withAlpha } from './color';
import { useLoop } from './motion';

export interface ArtFillProps extends ViewProps {
  /** A named preset from tokens/glow.ts or your own base + spots. */
  art: ArtName | ArtPreset;
  /** Strength of the white fade at the bottom (0 = none). Default 0.8, as on art cards. */
  fade?: number;
  /** Where the fade starts, 0..1 from the top. Default 0.35. */
  fadeFrom?: number;
  /** Corner radius; the art is clipped to it. */
  radius?: number;
  /** Blur of the colour spots. Default 26 (cards); small tiles use about 14. */
  blur?: number;
  /** One drift there or back, in ms. Default 14 s. */
  drift?: number;
  /**
   * Let the colours drift. Default off: drifting art re-blurs the card every frame, which kept
   * the app at full CPU while idle. The still art looks the same.
   */
  animate?: boolean;
  children?: ReactNode;
}

/**
 * Dreamy colour art: the mockup's blurred `radial-gradient` spots on a box 1.7x the card. With
 * `animate` it drifts (−8%, 6%), turning 10° and growing 1.15x over 14 s and back.
 * Content goes on top as children.
 */
export function ArtFill({
  art,
  fade = 0.8,
  fadeFrom = 0.35,
  radius = 0,
  blur = blurToken.art,
  drift = 14000,
  animate = false,
  style,
  children,
  onLayout,
  ...rest
}: ArtFillProps) {
  const preset = typeof art === 'string' ? presets[art] : art;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
    onLayout?.(e);
  };
  return (
    <View
      {...rest}
      onLayout={handleLayout}
      style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor: preset.base }, style]}
    >
      {size.w > 0 ? (
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Spots
            preset={preset}
            w={size.w}
            h={size.h}
            blur={blur}
            drift={drift}
            animate={animate}
          />
          {fade > 0 ? (
            <Rect x={0} y={0} width={size.w} height={size.h}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, size.h)}
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0)', `rgba(255,255,255,${fade})`]}
                positions={[0, fadeFrom, 1]}
              />
            </Rect>
          ) : null}
        </Canvas>
      ) : null}
      {children}
    </View>
  );
}

function Spots({
  preset,
  w,
  h,
  blur,
  drift,
  animate,
}: {
  preset: ArtPreset;
  w: number;
  h: number;
  blur: number;
  drift: number;
  animate: boolean;
}) {
  // The mockup draws on `inset: -35%`: a box 1.7x the card, centred on it.
  const bw = w * 1.7;
  const bh = h * 1.7;
  const bx = -0.35 * w;
  const by = -0.35 * h;
  const p = useLoop(drift, 0, animate);
  const transform = useDerivedValue(() => [
    { translateX: -0.08 * bw * p.value },
    { translateY: 0.06 * bh * p.value },
    { rotate: (10 * Math.PI * p.value) / 180 },
    { scale: 1 + 0.15 * p.value },
  ]);
  return (
    <Group
      layer={
        <Paint>
          <Blur blur={blur} />
        </Paint>
      }
    >
      <Group transform={transform} origin={vec(w / 2, h / 2)}>
        <Rect x={bx} y={by} width={bw} height={bh} color={preset.base} />
        {preset.spots.map((spot) => (
          <Spot
            key={`${spot.x}-${spot.y}-${spot.color}`}
            spot={spot}
            bx={bx}
            by={by}
            bw={bw}
            bh={bh}
          />
        ))}
      </Group>
    </Group>
  );
}

/**
 * One CSS `radial-gradient(at x% y%, colour, transparent stop%)`. The default CSS shape is an
 * ellipse reaching the farthest corner: its radii are √2 × the farthest-side distances.
 */
function Spot({
  spot,
  bx,
  by,
  bw,
  bh,
}: {
  spot: ArtSpot;
  bx: number;
  by: number;
  bw: number;
  bh: number;
}) {
  const cx = bx + (spot.x / 100) * bw;
  const cy = by + (spot.y / 100) * bh;
  const rx = Math.SQRT2 * Math.max(cx - bx, bx + bw - cx);
  const ry = Math.SQRT2 * Math.max(cy - by, by + bh - cy);
  const c = vec(cx, cy);
  return (
    <Rect x={bx} y={by} width={bw} height={bh}>
      <RadialGradient
        c={c}
        r={rx}
        colors={[spot.color, withAlpha(spot.color, 0)]}
        positions={[0, spot.stop / 100]}
        transform={[{ scaleY: ry / rx }]}
        origin={c}
      />
    </Rect>
  );
}
