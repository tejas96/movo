import { Icon, type IconName, Sheet, Text, Toggle, theme } from '@movo/design-system';
import { type ReactNode, useEffect } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { ArLayers } from './spatial/scene';
import type { Turn } from './steps';

/**
 * HUD pieces for the camera screen. Dark glass over video, white type, one accent for the destination.
 * Everything here is static chrome; nothing re-renders per camera frame.
 */

export const GLASS = 'rgba(14, 14, 18, 0.64)';
export const GLASS_SOFT = 'rgba(14, 14, 18, 0.46)';
export const ACCENT = '#F29914';
export const SERVICE_HEX: Record<'water' | 'drain' | 'electric', string> = {
  water: '#3D9EFF',
  drain: '#549989',
  electric: '#F29914',
};

export function confidenceHex(c: number): string {
  if (c >= 0.7) return '#34C277';
  if (c >= 0.4) return ACCENT;
  return '#E85C5C';
}

export function RoundButton({
  icon,
  onPress,
  label,
  light,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  light?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.round, light ? styles.roundLight : styles.roundDark]}
    >
      <Icon name={icon} size={22} color={light ? theme.color.icon.primary : '#FFFFFF'} />
    </Pressable>
  );
}

export function GlassPill({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.pill, style]}>{children}</View>;
}

/** Corner brackets with a slow breath and a scan line, shown until a plate gives a fix. */
export function ScanReticle({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  const breath = useSharedValue(0);
  const sweep = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    sweep.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breath, sweep]);
  const frame = useAnimatedStyle(() => ({
    transform: [{ scale: 0.96 + breath.value * 0.06 }],
    opacity: 0.75 + breath.value * 0.25,
  }));
  const line = useAnimatedStyle(() => ({
    transform: [{ translateY: -96 + sweep.value * 192 }],
    opacity: 0.35 + 0.45 * Math.sin(sweep.value * Math.PI),
  }));
  return (
    <View pointerEvents="box-none" style={styles.reticleWrap}>
      <Animated.View style={[styles.reticle, frame]}>
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
        <Animated.View style={[styles.scanLine, line]} />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(360)} style={styles.reticleText}>
        <Text variant="title" style={styles.white} center>
          {title}
        </Text>
        <Text variant="caption" style={styles.white70} center>
          {body}
        </Text>
      </Animated.View>
      <Pressable accessibilityRole="button" onPress={onAction} style={styles.manualLink}>
        <Icon name="location" size={18} color={theme.color.icon.primary} />
        <Text variant="bodyMedium">{action}</Text>
      </Pressable>
    </View>
  );
}

const TURN_ICON: Record<Turn, IconName> = {
  straight: 'chevronUp',
  left: 'chevronLeft',
  right: 'chevronRight',
  back: 'chevronDown',
};

/** The one thing to do now: a big arrow, the target, the distance. */
export function NextStepCard({
  turn,
  title,
  sub,
  distance,
}: {
  turn: Turn | null;
  title: string;
  sub: string | null;
  distance: string;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      exiting={FadeOutUp.duration(200)}
      style={styles.step}
    >
      <View style={styles.stepIcon}>
        <Icon name={turn ? TURN_ICON[turn] : 'location'} size={28} color="#FFFFFF" />
      </View>
      <View style={styles.stepText}>
        <Text variant="title" style={styles.white} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text variant="caption" style={styles.white70} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Text variant="h3" style={styles.white}>
        {distance}
      </Text>
    </Animated.View>
  );
}

/** Small chips naming the service layers that are on, plus the "indicative" warning. */
export function LegendRow({
  layers,
  labels,
  indicative,
}: {
  layers: ArLayers;
  labels: Record<'water' | 'drain' | 'electric', string>;
  indicative: string;
}) {
  const on = (['water', 'drain', 'electric'] as const).filter((k) => layers[k]);
  if (on.length === 0) return null;
  return (
    <Animated.View entering={FadeInDown.duration(260)} style={styles.legend}>
      {on.map((k) => (
        <View key={k} style={styles.legendChip}>
          <View style={[styles.dot, { backgroundColor: SERVICE_HEX[k] }]} />
          <Text variant="micro" style={styles.white}>
            {labels[k]}
          </Text>
        </View>
      ))}
      <View style={[styles.legendChip, styles.legendWarn]}>
        <Icon name="warning" size={14} color={ACCENT} />
        <Text variant="micro" style={{ color: ACCENT }}>
          {indicative}
        </Text>
      </View>
    </Animated.View>
  );
}

export function LayersSheet({
  visible,
  onClose,
  layers,
  onToggle,
  title,
  labels,
  note,
}: {
  visible: boolean;
  onClose: () => void;
  layers: ArLayers;
  onToggle: (k: keyof ArLayers) => void;
  title: string;
  labels: Record<keyof ArLayers, string>;
  note: string;
}) {
  const rows: Array<{ key: keyof ArLayers; icon: IconName; color?: string }> = [
    { key: 'route', icon: 'location' },
    { key: 'rooms', icon: 'home' },
    { key: 'water', icon: 'water', color: SERVICE_HEX.water },
    { key: 'drain', icon: 'refresh', color: SERVICE_HEX.drain },
    { key: 'electric', icon: 'electricity', color: SERVICE_HEX.electric },
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.sheetCard}>
        {rows.map((r, i) => (
          <View key={r.key} style={[styles.sheetRow, i > 0 && styles.sheetDivider]}>
            <View style={styles.sheetIcon}>
              <Icon name={r.icon} size={20} color={r.color ?? theme.color.icon.primary} />
            </View>
            <Text variant="bodyMedium" className="flex-1">
              {labels[r.key]}
            </Text>
            <Toggle value={layers[r.key]} onValueChange={() => onToggle(r.key)} />
          </View>
        ))}
      </View>
      <View style={styles.note}>
        <Icon name="warning" size={18} color={theme.color.status.warning.fg} />
        <Text variant="caption" tone="secondary" className="flex-1">
          {note}
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  white: { color: '#FFFFFF' },
  white70: { color: 'rgba(255,255,255,0.72)' },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundDark: { backgroundColor: GLASS },
  roundLight: { backgroundColor: '#FFFFFF' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: GLASS,
  },
  reticleWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  reticle: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  manualLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  corner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: '#FFFFFF',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 14,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 14,
  },
  scanLine: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  reticleText: {
    maxWidth: 300,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: GLASS_SOFT,
    gap: 4,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    paddingRight: 18,
    borderRadius: 22,
    backgroundColor: GLASS,
  },
  stepIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, gap: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: GLASS,
  },
  legendWarn: { backgroundColor: 'rgba(242,153,20,0.16)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sheetCard: { borderRadius: 20, backgroundColor: theme.color.bg.nested, paddingHorizontal: 14 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 56 },
  sheetDivider: { borderTopWidth: 1, borderTopColor: theme.color.border.divider },
  sheetIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.color.bg.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    paddingTop: 14,
    paddingHorizontal: 4,
  },
});
