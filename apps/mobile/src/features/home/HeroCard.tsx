import type { AttentionItem, UpcomingItem } from '@movo/contracts';
import { Button, Press, photos, StatusPill, Text } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { whenRange } from '../../core/util/time';
import { CountUp, PhotoScrim, photoStyles } from './effects';
import { attentionEntry } from './registry';
import type { HeroSpec, HomeCtx } from './types';

/** The one black surface on Home: what matters most right now, with its action. */
export function HeroCard({
  hero,
  next,
}: {
  hero: AttentionItem | undefined;
  next: UpcomingItem | undefined;
}) {
  const { t } = useTranslation(['home', 'emergency', 'money']);
  const nav = useNav();
  const ctx: HomeCtx = { t, nav };
  const card = (hero && attentionEntry(hero)?.hero?.card(hero, ctx)) ?? allClear(ctx, next);

  return (
    <Press
      accessibilityRole="button"
      onPress={card.cta?.go}
      disabled={!card.cta}
      className="mt-4 overflow-hidden rounded-xl bg-ink"
      style={styles.hero}
    >
      <Image source={card.photo} resizeMode="cover" style={photoStyles.fill} />
      <PhotoScrim top={0.1} bottom={0.82} />
      <View style={styles.heroBody}>
        <View className="flex-row items-center gap-2">
          {card.danger ? (
            <StatusPill label={t('emergency:status.ACTIVE')} tone="danger" dot />
          ) : null}
          <Text variant="label" style={photoStyles.dim} numberOfLines={1} className="shrink">
            {card.label}
          </Text>
        </View>
        {card.amountPaise !== undefined ? (
          <View className="mt-1.5">
            <CountUp paise={card.amountPaise} />
          </View>
        ) : (
          <Text variant="h2" tone="inverse" numberOfLines={2} className="mt-1.5">
            {card.value}
          </Text>
        )}
        {card.caption ? (
          <Text variant="caption" style={photoStyles.dim} numberOfLines={2} className="mt-0.5">
            {card.caption}
          </Text>
        ) : null}
        {card.cta ? (
          <View className="mt-4 flex-row">
            <Button label={card.cta.label} variant="white" size="sm" inline onPress={card.cta.go} />
          </View>
        ) : null}
      </View>
    </Press>
  );
}

/** Nothing needs the user: say so, and point at the next meeting or event if there is one. */
function allClear({ t, nav }: HomeCtx, next: UpcomingItem | undefined): HeroSpec {
  return {
    photo: photos.society2,
    label: t('home:hero.clear.label'),
    value: t('home:allClearBody'),
    caption: next
      ? t('home:hero.clear.next', {
          title: next.title,
          when: whenRange(next.startsAt, next.endsAt),
        })
      : undefined,
    cta: next
      ? {
          label: t('home:hero.clear.cta'),
          go: () =>
            next.kind === 'MEETING'
              ? nav.navigate('MeetingDetail', { meetingId: next.id })
              : nav.navigate('EventDetail', { eventId: next.id }),
        }
      : undefined,
  };
}

const styles = StyleSheet.create({
  hero: { minHeight: 216 },
  heroBody: { flex: 1, justifyContent: 'flex-end', padding: 20 },
});
