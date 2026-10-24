import { StyleSheet, View } from 'react-native';
import type { IconName } from '../icons';
import { type TintName, tint, tintCycle } from '../tokens';
import { type IconMotion, MovingIcon } from './drawings/MovingIcon';
import { Icon } from './Icon';
import { Press } from './Press';
import { Text } from './Text';
import { theme } from './theme';

export interface TintDiscProps {
  icon: IconName;
  /** A tint name, or any colour. */
  tint?: TintName | string;
  /** How the icon moves once when it appears. Default still. */
  motion?: IconMotion;
  size?: number;
  /** Small coloured dot, top right (unread, alert). */
  dot?: string | undefined;
  /** Small black counter, top right. Wins over `dot`. */
  count?: number | undefined;
}

/** A steady tint for a name: the same icon gets the same colour on every screen. */
export function tintFor(name: string): TintName {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return tintCycle[h % tintCycle.length] as TintName;
}

const tintColor = (t: TintName | string | undefined) =>
  t === undefined ? tint.peach : t in tint ? tint[t as TintName] : t;

/** The round soft-tint circle with a line icon, as on the Society grid and the mockup lists. */
export function TintDisc({
  icon,
  tint: t,
  motion = 'still',
  size = 54,
  dot,
  count,
}: TintDiscProps) {
  return (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: tintColor(t) },
      ]}
    >
      {motion === 'still' ? (
        // A still icon skips the motion hook, so long lists schedule no frames.
        <Icon name={icon} size={Math.round(size * 0.41)} color={theme.color.icon.primary} />
      ) : (
        <MovingIcon name={icon} motion={motion} size={Math.round(size * 0.41)} />
      )}
      {count ? (
        <View style={styles.count}>
          <Text variant="micro" tone="inverse" className="text-[11px] leading-[14px]">
            {count > 99 ? '99+' : String(count)}
          </Text>
        </View>
      ) : dot ? (
        <View style={[styles.dot, { backgroundColor: dot }]} />
      ) : null}
    </View>
  );
}

export interface IconGridItem {
  key: string;
  icon: IconName;
  label: string;
  /** One small gray line under the label ("2 vendors"). */
  hint?: string | undefined;
  /** Default: the next tint in `tintCycle`. */
  tint?: TintName | string;
  motion?: IconMotion;
  dot?: string | undefined;
  count?: number | undefined;
  onPress?: () => void;
}

export interface IconGridProps {
  items: readonly IconGridItem[];
  /** 4 on the Society tab; 3 when items carry a hint. */
  columns?: 3 | 4;
}

/**
 * The Society tab's grid: round tinted circles with a moving line icon and a centred label.
 * Put it inside a Glass card. Every grid of places to go uses this.
 */
export function IconGrid({ items, columns = 4 }: IconGridProps) {
  const width = columns === 4 ? '25%' : '33.333%';
  return (
    <View style={styles.grid}>
      {items.map((item, i) => {
        const body = (
          <>
            <TintDisc
              icon={item.icon}
              tint={item.tint ?? tintCycle[i % tintCycle.length]}
              motion={item.motion ?? 'bob'}
              dot={item.dot}
              count={item.count}
            />
            <Text variant="label" center numberOfLines={2} className="font-medium">
              {item.label}
            </Text>
            {item.hint ? (
              <Text variant="micro" tone="secondary" center numberOfLines={1}>
                {item.hint}
              </Text>
            ) : null}
          </>
        );
        return item.onPress ? (
          <Press
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.hint ? `${item.label}, ${item.hint}` : item.label}
            onPress={item.onPress}
            scaleTo={0.92}
            style={[styles.item, { width }]}
          >
            {body}
          </Press>
        ) : (
          <View key={item.key} style={[styles.item, { width }]}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  item: { alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(70,40,70,0.06)',
  },
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  count: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.text.primary,
  },
});
