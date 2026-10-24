import {
  ArtCard,
  type ArtName,
  type IconMotion,
  type IconName,
  IconSquare,
  MovingIcon,
  Text,
  theme,
} from '@movo/design-system';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

export interface DetailHeroProps {
  art: ArtName;
  onBack: () => void;
  /** Top right on the art, usually the options button. */
  trailing?: ReactNode;
  /** A drawing in the middle of the art. Use `icon` for the usual moving icon on a white disc. */
  drawing?: ReactNode;
  icon?: { name: IconName; motion: IconMotion };
  /** Small pills above the title (category, status). */
  pills?: ReactNode;
  title: string;
  /** One gray line under the title: who and when, or when and where. */
  meta?: string | undefined;
  height?: number;
}

/**
 * The top of a detail screen, as on the Event mockup: moving colour art in a white rim, back
 * and options buttons on it, a small moving drawing, pills, a big title and a meta line.
 */
export function DetailHero({
  art,
  onBack,
  trailing,
  drawing,
  icon,
  pills,
  title,
  meta,
  height = 300,
}: DetailHeroProps) {
  const { t } = useTranslation('common');
  return (
    <ArtCard
      art={art}
      height={height}
      radius={40}
      fade={0.55}
      fadeFrom={0.5}
      contentStyle={styles.hero}
    >
      <View style={styles.middle} pointerEvents="none">
        {drawing ??
          (icon ? (
            <View style={styles.disc}>
              <MovingIcon name={icon.name} motion={icon.motion} size={34} />
            </View>
          ) : null)}
      </View>
      <View style={styles.top}>
        <IconSquare
          icon="back"
          variant="linear"
          diameter={46}
          onPress={onBack}
          accessibilityLabel={t('actions.back')}
        />
        {trailing}
      </View>
      <View>
        {pills ? <View style={styles.pills}>{pills}</View> : null}
        <Text style={styles.title} numberOfLines={3}>
          {title}
        </Text>
        {meta ? (
          <Text variant="caption" style={styles.meta} numberOfLines={2}>
            {meta}
          </Text>
        ) : null}
      </View>
    </ArtCard>
  );
}

/** A white pill with an orange dot, for the hero ("Event · by committee"). */
export function HeroPill({
  label,
  dot = true,
  dotColor,
}: {
  label: string;
  dot?: boolean;
  /** Default orange; red for overdue or urgent. */
  dotColor?: string;
}) {
  return (
    <View style={styles.pill}>
      {dot ? <View style={[styles.dot, dotColor ? { backgroundColor: dotColor } : null]} /> : null}
      <Text variant="label" className="font-medium" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 14, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  middle: { position: 'absolute', left: 0, right: 0, top: 70, alignItems: 'center' },
  disc: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 24px rgba(70,40,70,0.10)',
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
    maxWidth: '100%',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.color.accent.fg },
  title: {
    marginTop: 10,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.5,
    color: theme.color.text.primary,
  },
  meta: { color: '#4D4C52' },
});
