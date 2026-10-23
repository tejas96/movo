import { Canvas, Mask, Path, RadialGradient, Rect, Skia, vec } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { dots } from '../../tokens/glow';

export interface DotTextureProps {
  /** Where the dots are strongest, 0..1 of the box. Default top middle (0.5, 0.28). */
  center?: { x: number; y: number };
  /** How far the dots reach before fading out, 0..1 of the farthest corner. Default 0.72. */
  reach?: number;
}

/**
 * The fine dot grid behind greetings, fading out from one point.
 * Place it as the first child of a card with `overflow: hidden`.
 */
export function DotTexture({ center = { x: 0.5, y: 0.28 }, reach = 0.72 }: DotTextureProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const path = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    for (let y = dots.gap / 2; y < size.h; y += dots.gap) {
      for (let x = dots.gap / 2; x < size.w; x += dots.gap) b.addCircle(x, y, dots.radius);
    }
    return b.detach();
  }, [size.w, size.h]);
  const cx = center.x * size.w;
  const cy = center.y * size.h;
  const far = Math.hypot(Math.max(cx, size.w - cx), Math.max(cy, size.h - cy));
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          <Mask
            mask={
              <Rect x={0} y={0} width={size.w} height={size.h}>
                <RadialGradient c={vec(cx, cy)} r={far * reach} colors={['black', 'transparent']} />
              </Rect>
            }
          >
            <Path path={path} color={dots.color} />
          </Mask>
        </Canvas>
      ) : null}
    </View>
  );
}
