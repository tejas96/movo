import { BlurMask, Canvas, Group, Oval, vec } from '@shopify/react-native-skia';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';
import { blur } from '../../tokens/effects';
import { type GlowBlob, type GlowSceneName, glowScene } from '../../tokens/glow';
import { useLoop } from './motion';

export interface BackdropProps {
  /** Which glow sits behind the screen. Default `soft` (pink and lavender at the bottom). */
  scene?: GlowSceneName;
  /**
   * Let the blobs drift. Default off: a drifting blob re-blurs the whole screen every frame,
   * which kept the app at full CPU while idle. The still glow looks the same.
   */
  animate?: boolean;
}

/**
 * The soft pastel glow at the bottom of every Soft Glow screen: two or three big blurred
 * blobs, still unless `animate`. Draws behind everything and never takes touches.
 */
export function Backdrop({ scene = 'soft', animate = false }: BackdropProps) {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        {glowScene[scene].map((b, i) => (
          // The blobs of a scene are fixed, so the index is a stable key.
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed list
          <Blob key={i} blob={b} screenW={width} screenH={height} animate={animate} />
        ))}
      </Canvas>
    </View>
  );
}

function Blob({
  blob,
  screenW,
  screenH,
  animate,
}: {
  blob: GlowBlob;
  screenW: number;
  screenH: number;
  animate: boolean;
}) {
  const p = useLoop(blob.period / 2, 0, animate);
  const x = blob.left ?? screenW - (blob.right ?? 0) - blob.width;
  const y = blob.top ?? screenH - (blob.bottom ?? 0) - blob.height;
  const transform = useDerivedValue(() => [
    { translateX: blob.dx * p.value },
    { translateY: blob.dy * p.value },
    { scale: 1 + (blob.scale - 1) * p.value },
  ]);
  return (
    <Group transform={transform} origin={vec(x + blob.width / 2, y + blob.height / 2)}>
      <Oval
        x={x}
        y={y}
        width={blob.width}
        height={blob.height}
        color={blob.color}
        opacity={blob.opacity}
      >
        <BlurMask blur={blur.glow} style="normal" respectCTM />
      </Oval>
    </Group>
  );
}
