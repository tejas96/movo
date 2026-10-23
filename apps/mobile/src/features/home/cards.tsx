import type { NoticeSummary, UpcomingItem } from '@movo/contracts';
import {
  ArrowCircle,
  ArtCard,
  ArtFill,
  Building,
  Button,
  DotTexture,
  DuesRing,
  Glass,
  Icon,
  Megaphone,
  Press,
  type RingSegment,
  Strong,
  Text,
  theme,
  useCountUp,
} from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { day, greetingKey, whenRange } from '../../core/util/date';
import { money } from '../../core/util/money';

/** Small white pill with a coloured dot, used on art cards (All good, Pinned). */
export function DotPill({ label, dot }: { label: string; dot: string }) {
  return (
    <View style={styles.dotPill}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text variant="label" className="font-medium" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** The greeting card: society name, "Good evening **Name**, here is your home today", facts. */
export function GreetingCard({
  society,
  onSwitch,
  firstName,
  facts,
}: {
  society: string;
  onSwitch: (() => void) | undefined;
  firstName: string;
  facts: readonly string[];
}) {
  const { t } = useTranslation('home');
  const greeting = t(`greeting.${greetingKey()}`);
  return (
    <Glass radius={32} style={styles.greeting}>
      <DotTexture />
      <Press
        onPress={onSwitch}
        disabled={!onSwitch}
        accessibilityRole="button"
        className="flex-row items-center gap-1"
      >
        <Text variant="label" tone="secondary" numberOfLines={1}>
          {society}
        </Text>
        {onSwitch ? <Icon name="chevronDown" size={14} color={theme.color.text.secondary} /> : null}
      </Press>
      <Text variant="greet" center>
        {greeting} {firstName ? <Strong>{`${firstName},`}</Strong> : null} {t('glow.greetTail')}
      </Text>
      <View style={styles.facts}>
        {facts.map((f) => (
          <View key={f} style={styles.fact}>
            <Text variant="label" numberOfLines={1}>
              {f}
            </Text>
          </View>
        ))}
      </View>
    </Glass>
  );
}

/** "Society meeting · Sun 26 Oct | 10 AM · Clubhouse" pill with the play button. */
export function NextUpPill({ item }: { item: UpcomingItem }) {
  const nav = useNav();
  const open = () =>
    item.kind === 'MEETING'
      ? nav.navigate('MeetingDetail', { meetingId: item.id })
      : nav.navigate('EventDetail', { eventId: item.id });
  const when = whenRange(item.startsAt, item.endsAt);
  return (
    <Glass radius={999} onPress={open} accessibilityLabel={item.title} style={styles.nextUp}>
      <ArtFill art="meeting" radius={26} fade={0} blur={14} style={styles.nextArt} />
      <View style={styles.flex}>
        <Text variant="title" numberOfLines={1}>
          {item.title}
        </Text>
        <Text variant="label" tone="secondary" numberOfLines={1}>
          {item.location ? `${when} · ${item.location}` : when}
        </Text>
      </View>
      <ArrowCircle size={44} glyph="play" style={styles.nextArrow} />
    </Glass>
  );
}

export type HomeStatus = 'good' | 'alert' | 'overdue';

/** "Your home, **Flat A-101**" with the floating building and the flat pin. */
export function HomeCard({
  flat,
  pin,
  detail,
  status,
  onPress,
}: {
  flat: string;
  pin: string;
  detail: string;
  status: HomeStatus;
  onPress: () => void;
}) {
  const { t } = useTranslation('home');
  const dot =
    status === 'alert'
      ? theme.color.status.danger.fg
      : status === 'overdue'
        ? theme.color.accent.fg
        : theme.color.status.success.fg;
  return (
    <ArtCard
      art="home"
      height={150}
      onPress={onPress}
      accessibilityLabel={t('glow.home.label', { flat })}
    >
      <View style={styles.homeText}>
        <DotPill label={t(`glow.home.${status}`)} dot={dot} />
        <Text variant="h2" className="font-normal" numberOfLines={2}>
          {t('glow.home.yours')} <Strong>{t('glow.home.flat', { flat })}</Strong>
        </Text>
        <Text variant="label" tone="soft" numberOfLines={2}>
          {detail}
        </Text>
      </View>
      <View style={styles.building} pointerEvents="none">
        <Building width={118} pin={pin.length <= 4 ? pin : undefined} />
      </View>
    </ArtCard>
  );
}

/** Maintenance card: the dues ring, the amount counting up and the pay button. */
export function DuesCard({
  outstandingPaise,
  overdue,
  nextDueDate,
  openBills,
  segments,
  onPay,
}: {
  outstandingPaise: number;
  overdue: boolean;
  nextDueDate: string | null;
  openBills: number;
  segments: readonly RingSegment[];
  onPay: () => void;
}) {
  const { t } = useTranslation('home');
  const rupees = useCountUp(Math.round(outstandingPaise / 100));
  const owes = outstandingPaise > 0;
  const paid = segments.filter((s) => s === 'paid').length;
  const due = segments.filter((s) => s === 'due').length;
  const caption = !owes
    ? t('glow.dues.nothingDue')
    : overdue && nextDueDate
      ? t('glow.dues.overdueSince', { date: day(nextDueDate, 'short') })
      : nextDueDate
        ? t('glow.dues.dueBy', { date: day(nextDueDate, 'short') })
        : '';
  return (
    <Glass style={styles.dues}>
      <View style={styles.duesHead}>
        <Text variant="h3">{t('glow.dues.title')}</Text>
        <Text variant="label" tone="secondary" numberOfLines={1} className="shrink">
          {openBills > 0 ? t('glow.dues.openBills', { count: openBills }) : t('glow.dues.allPaid')}
        </Text>
      </View>
      <View style={styles.duesBody}>
        <DuesRing
          width={128}
          segments={segments}
          accessibilityLabel={t('glow.dues.ring', { paid, due })}
        />
        <View style={styles.duesText}>
          {caption ? (
            <Text variant="label" tone={overdue && owes ? 'danger' : 'secondary'} numberOfLines={2}>
              {caption}
            </Text>
          ) : null}
          <Text
            className="font-medium"
            style={styles.amount}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {money(rupees * 100)}
          </Text>
        </View>
      </View>
      <Button
        arrow
        size="md"
        label={
          owes ? t('glow.dues.pay', { amount: money(outstandingPaise) }) : t('glow.dues.history')
        }
        onPress={onPay}
      />
    </Glass>
  );
}

/** Notices art card with the wobbling megaphone. */
export function NoticesCard({
  unread,
  latest,
  onPress,
}: {
  unread: number;
  latest: NoticeSummary | undefined;
  onPress: () => void;
}) {
  const { t } = useTranslation('home');
  const sub = latest
    ? unread > 0
      ? t('glow.notices.sub', { count: unread, title: latest.title })
      : latest.title
    : t('tiles.noticesEmpty');
  return (
    <ArtCard
      art="rose"
      height={92}
      onPress={onPress}
      accessibilityLabel={t('notices')}
      contentStyle={styles.line}
    >
      <View style={styles.lineIcon} pointerEvents="none">
        <Megaphone />
      </View>
      <View style={styles.flex}>
        <Text variant="h3">{t('notices')}</Text>
        <Text variant="label" tone="soft" numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <ArrowCircle />
    </ArtCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  bottom: { justifyContent: 'flex-end' },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  lineIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  greeting: {
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 28,
    alignItems: 'center',
    gap: 14,
  },
  facts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  fact: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
  },
  nextUp: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8 },
  nextArt: { width: 52, height: 52 },
  nextArrow: { marginRight: 2 },
  homeText: { width: '62%', gap: 6 },
  building: { position: 'absolute', right: 4, bottom: -8 },
  dues: { padding: 18, paddingBottom: 16, gap: 12 },
  // The ring draws a little below its own box, so the body keeps room under it.
  duesBody: { flexDirection: 'row', alignItems: 'flex-end', gap: 16, paddingBottom: 14 },
  duesText: { flex: 1, minWidth: 0, gap: 2, paddingBottom: 4 },
  duesHead: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  amount: { fontSize: 32, lineHeight: 38, letterSpacing: -0.8, color: theme.color.text.primary },
});
