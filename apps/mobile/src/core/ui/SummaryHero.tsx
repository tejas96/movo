import {
  ArtCard,
  type ArtName,
  type IconMotion,
  type IconName,
  MovingIcon,
  Text,
  useCountUp,
} from '@movo/design-system';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

export interface SummaryHeroProps {
  art: ArtName;
  /** Small gray line above the value ("My points · FY 2026-27"). */
  label: string;
  /** The big value, already formatted. */
  value: string;
  /** Count up to this number once, shown through `format`. Wins over `value` while it runs. */
  countTo?: number;
  format?: (n: number) => string;
  /** A small drawing at the top right (coins). Use `icon` for a moving icon on a white disc. */
  drawing?: ReactNode;
  icon?: { name: IconName; motion: IconMotion };
  /** Pills under the value. */
  pills?: ReactNode;
  /** Anything below: a progress bar, a button. */
  children?: ReactNode;
}

/**
 * The colour card at the top of a summary screen, like the Money card on the mockup: colour
 * art in a white rim, a small label, one big value, pills, then anything else.
 */
export function SummaryHero({
  art,
  label,
  value,
  countTo,
  format,
  drawing,
  icon,
  pills,
  children,
}: SummaryHeroProps) {
  return (
    <ArtCard art={art} contentStyle={styles.content}>
      {drawing || icon ? (
        <View style={styles.drawing} pointerEvents="none">
          {drawing ??
            (icon ? (
              <View style={styles.disc}>
                <MovingIcon name={icon.name} motion={icon.motion} size={28} />
              </View>
            ) : null)}
        </View>
      ) : null}
      <Text variant="caption" tone="soft" numberOfLines={2} style={styles.label}>
        {label}
      </Text>
      {countTo !== undefined ? (
        <CountValue to={countTo} format={format} />
      ) : (
        <Text variant="display" style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      )}
      {pills ? <View style={styles.pills}>{pills}</View> : null}
      {children}
    </ArtCard>
  );
}

function CountValue({ to, format }: { to: number; format?: ((n: number) => string) | undefined }) {
  const n = useCountUp(to);
  return (
    <Text variant="display" style={styles.value} numberOfLines={1}>
      {format ? format(n) : String(n)}
    </Text>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22 },
  drawing: { position: 'absolute', right: 18, top: 16 },
  disc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(70,40,70,0.10)',
  },
  label: { marginRight: 90 },
  value: { marginTop: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
});
