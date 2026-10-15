import type { AttentionItem } from '@movo/contracts';
import { type BoldIconName, Icon, Press, Row, Text, theme } from '@movo/design-system';
import {
  Image,
  type ImageSourcePropType,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type { HomeCtx } from '../../core/home/types';
import { PhotoScrim, photoStyles } from './effects';
import { attentionEntry } from './registry';

/** One "Needs you" row, drawn from the entry its feature registered. Unknown types draw nothing. */
export function AttentionRow({ item, ctx }: { item: AttentionItem; ctx: HomeCtx }) {
  const entry = attentionEntry(item);
  if (!entry) return null;
  const { onPress, ...row } = entry.row(item, ctx);
  return <Row {...row} onPress={onPress} />;
}

/** Photo tile for Home: the photo fills it, a count sits top left, label and hint in white below. */
export function HomeTile({
  source,
  icon,
  label,
  hint,
  count,
  onPress,
}: {
  source: ImageSourcePropType;
  icon: BoldIconName;
  label: string;
  hint: string;
  count?: number | undefined;
  onPress: () => void;
}) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="flex-1 overflow-hidden rounded-lg bg-card"
      style={styles.tile}
    >
      <Image source={source} resizeMode="cover" style={photoStyles.fill} />
      <PhotoScrim top={0} bottom={0.78} />
      {count ? (
        <View className="absolute left-3 top-3 h-6 min-w-6 items-center justify-center rounded-full bg-overlay px-2">
          <Text variant="micro">{count > 99 ? '99+' : String(count)}</Text>
        </View>
      ) : null}
      <View style={styles.tileText}>
        <View className="flex-row items-center gap-1.5">
          <Icon name={icon} variant="bold" size={16} color={theme.color.text.onInk} />
          <Text variant="bodyMedium" tone="inverse" className="font-semibold" numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text variant="micro" style={photoStyles.dim} numberOfLines={1} className="font-normal">
          {hint}
        </Text>
      </View>
    </Press>
  );
}

export interface QuickItem {
  key: string;
  icon: BoldIconName;
  label: string;
  dot?: boolean;
  go: () => void;
}

export function QuickGrid({ items }: { items: readonly QuickItem[] }) {
  const { width } = useWindowDimensions();
  const gap = 10;
  // Up to five fit in one row; more than that wraps in rows of four.
  const columns = items.length <= 5 ? Math.max(items.length, 1) : 4;
  const tile = (width - theme.layout.gutter * 2 - gap * (columns - 1)) / columns;
  return (
    <View className="mt-4 flex-row flex-wrap" style={{ gap }}>
      {items.map((q) => (
        <Press
          key={q.key}
          accessibilityRole="button"
          accessibilityLabel={q.label}
          onPress={q.go}
          scaleTo={0.92}
          className="items-center gap-1.5"
          style={{ width: tile }}
        >
          <View className="h-14 w-14 items-center justify-center rounded-md bg-card">
            <Icon name={q.icon} variant="bold" size={24} />
            {q.dot ? <View style={styles.dot} /> : null}
          </View>
          <View style={styles.quickLabel}>
            <Text variant="micro" center numberOfLines={2} className="font-medium">
              {q.label}
            </Text>
          </View>
        </Press>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { height: 132 },
  tileText: { position: 'absolute', left: 12, right: 12, bottom: 12, gap: 1 },
  quickLabel: { height: 32 },
  dot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.status.danger.fg,
    borderWidth: 2,
    borderColor: theme.color.bg.card,
  },
});
