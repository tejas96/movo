import type { AttentionItem } from '@movo/contracts';
import {
  type BoldIconName,
  Glass,
  Icon,
  Press,
  Row,
  SectionLabel,
  Text,
  theme,
} from '@movo/design-system';
import { StyleSheet, View } from 'react-native';
import type { HomeCtx } from '../../core/home/types';
import { attentionEntry } from './registry';

/** One "Needs you" row, drawn from the entry its feature registered. Unknown types draw nothing. */
export function AttentionRow({ item, ctx }: { item: AttentionItem; ctx: HomeCtx }) {
  const entry = attentionEntry(item);
  if (!entry) return null;
  const { onPress, ...row } = entry.row(item, ctx);
  return <Row {...row} onGray onPress={onPress} />;
}

export interface QuickItem {
  key: string;
  icon: BoldIconName;
  label: string;
  dot?: boolean;
  go: () => void;
}

/** Glass card of round shortcuts (Services, Emergency, Market, Manage). */
export function QuickActions({ title, items }: { title: string; items: readonly QuickItem[] }) {
  if (items.length === 0) return null;
  return (
    <Glass radius={28} style={styles.card}>
      <SectionLabel>{title}</SectionLabel>
      <View style={styles.grid}>
        {items.map((q) => (
          <Press
            key={q.key}
            accessibilityRole="button"
            accessibilityLabel={q.label}
            onPress={q.go}
            scaleTo={0.92}
            style={styles.item}
          >
            <View style={[styles.circle, theme.shadow.control]}>
              <Icon name={q.icon} size={22} color={theme.color.icon.primary} />
              {q.dot ? <View style={styles.dot} /> : null}
            </View>
            <Text variant="label" center numberOfLines={2} className="font-medium">
              {q.label}
            </Text>
          </Press>
        ))}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: 8, paddingBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  item: { width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.color.bg.nested,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.status.danger.fg,
    borderWidth: 2,
    borderColor: theme.color.bg.nested,
  },
});
