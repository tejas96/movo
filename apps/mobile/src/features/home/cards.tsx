import type { NoticeSummary, UpcomingItem } from '@movo/contracts';
import {
  ArrowCircle,
  ArtCard,
  ArtFill,
  AvatarStack,
  type AvatarTone,
  Building,
  Button,
  Coin,
  DotTexture,
  DuesRing,
  Glass,
  Icon,
  MapPin,
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
      height={214}
      onPress={onPress}
      accessibilityLabel={t('glow.home.label', { flat })}
    >
      <View style={styles.homeText}>
        <DotPill label={t(`glow.home.${status}`)} dot={dot} />
        <Text variant="h2" className="font-normal" numberOfLines={3}>
          {t('glow.home.yours')} <Strong>{t('glow.home.flat', { flat })}</Strong>
        </Text>
        <Text variant="label" tone="soft" numberOfLines={2}>
          {detail}
        </Text>
      </View>
      <View style={styles.building} pointerEvents="none">
        <Building width={180} pin={pin.length <= 4 ? pin : undefined} />
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
      <DuesRing segments={segments} accessibilityLabel={t('glow.dues.ring', { paid, due })}>
        {caption ? (
          <Text variant="label" tone="secondary">
            {caption}
          </Text>
        ) : null}
        <Text className="font-medium" style={styles.amount}>
          {money(rupees * 100)}
        </Text>
      </DuesRing>
      <Button
        arrow
        size="lg"
        className="mt-3"
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
      height={150}
      onPress={onPress}
      accessibilityLabel={t('notices')}
      contentStyle={styles.bottom}
    >
      <View style={styles.cornerBox} pointerEvents="none">
        <Megaphone />
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="h2">{t('notices')}</Text>
          <Text variant="label" tone="soft" numberOfLines={1}>
            {sub}
          </Text>
        </View>
        <ArrowCircle />
      </View>
    </ArtCard>
  );
}

/** The two short tiles: Bills (gold coin) and Find my way (bobbing pin). */
export function ShortcutTiles({
  onBills,
  onFindWay,
}: {
  onBills: (() => void) | undefined;
  onFindWay: () => void;
}) {
  const { t } = useTranslation('home');
  return (
    <View style={styles.tiles}>
      {onBills ? (
        <ArtCard
          art="meadow"
          height={150}
          radius={30}
          onPress={onBills}
          accessibilityLabel={t('glow.bills.title')}
          style={styles.bigTile}
          contentStyle={styles.tileContent}
        >
          <View style={styles.coin} pointerEvents="none">
            <Coin />
          </View>
          <Text variant="h3" style={styles.tileTitle} numberOfLines={2}>
            {t('glow.bills.title')}
          </Text>
          <Text variant="label" tone="soft" numberOfLines={1}>
            {t('glow.bills.sub')}
          </Text>
        </ArtCard>
      ) : null}
      <ArtCard
        art="dusk"
        height={150}
        radius={30}
        onPress={onFindWay}
        accessibilityLabel={t('glow.findWay.title')}
        style={styles.flex}
        contentStyle={styles.tileContent}
      >
        <View style={styles.pin} pointerEvents="none">
          <MapPin />
        </View>
        <Text variant="h3" style={styles.tileTitle} numberOfLines={2}>
          {t('glow.findWay.title')}
        </Text>
        <Text variant="label" tone="soft" numberOfLines={1}>
          {t('quick.ar')}
        </Text>
      </ArtCard>
    </View>
  );
}

/** Members art card with the bobbing avatar stack. */
export function MembersCard({
  people,
  more,
  sub,
  onPress,
}: {
  people: readonly { id: string; initials: string; tone?: AvatarTone }[];
  more: string | undefined;
  sub: string;
  onPress: () => void;
}) {
  const { t } = useTranslation('home');
  return (
    <ArtCard
      art="sand"
      height={120}
      onPress={onPress}
      accessibilityLabel={t('glow.members.title')}
      contentStyle={styles.bottom}
    >
      {people.length > 0 ? (
        <View style={styles.corner} pointerEvents="none">
          <AvatarStack bob people={people} more={more} />
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="h2">{t('glow.members.title')}</Text>
          <Text variant="label" tone="soft" numberOfLines={1}>
            {sub}
          </Text>
        </View>
        <ArrowCircle />
      </View>
    </ArtCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  bottom: { justifyContent: 'flex-end' },
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
  homeText: { width: 160, gap: 8 },
  building: { position: 'absolute', right: -2, bottom: 0 },
  dues: { padding: 18, paddingBottom: 16, alignItems: 'center' },
  duesHead: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  amount: { fontSize: 38, lineHeight: 44, letterSpacing: -1, color: theme.color.text.primary },
  cornerBox: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: { position: 'absolute', top: 16, right: 16 },
  tiles: { flexDirection: 'row', gap: 12 },
  bigTile: { flex: 1.6 },
  tileContent: { padding: 14, justifyContent: 'flex-end' },
  tileTitle: { fontSize: 18, lineHeight: 25 },
  coin: { position: 'absolute', top: 14, right: 14 },
  pin: { position: 'absolute', top: 16, left: 16 },
});
