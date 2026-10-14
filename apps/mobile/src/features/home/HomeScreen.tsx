import type { NoticeSummary, UpcomingItem } from '@movo/contracts';
import {
  Card,
  Icon,
  IconSquare,
  PhotoCard,
  Press,
  photos,
  Row,
  Screen,
  SectionHeader,
  Skeleton,
  Text,
  theme,
} from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSessionStore } from '../../core/auth/session.store';
import { useNav } from '../../core/navigation/types';
import { useCanManageSociety, useMeContext, useTenant } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { greetingKey, relative, whenRange } from '../../core/util/time';
import { EventPill } from '../events/EventsScreen';
import { MeetingStatusPill } from '../meetings/MeetingsScreen';
import { useHomeSummary } from './api';
import { Reveal } from './effects';
import { HeroCard } from './HeroCard';
import { attentionKey, pickHero, quickTiles } from './registry';
import { AttentionRow, HomeTile, QuickGrid, type QuickItem } from './tiles';
import type { HomeCtx, QuickCtx } from './types';

export function HomeScreen() {
  const { t } = useTranslation(['home', 'common', 'notices']);
  const nav = useNav();
  const tenant = useTenant();
  const me = useMeContext();
  const user = useSessionStore((s) => s.user);
  const summary = useHomeSummary(tenant.society.id);
  const canManage = useCanManageSociety();
  const attention = summary.data?.attention ?? [];
  const manySocieties = (me.data?.memberships.filter((m) => m.status === 'ACTIVE').length ?? 0) > 1;
  const firstName = user?.displayName.split(' ')[0] ?? '';

  // One thing on the black card; everything else stays in the "Needs you" rows.
  const hero = pickHero(attention);
  const rest = attention.filter((a) => a !== hero);
  const upcoming = summary.data?.upcoming ?? [];
  const notices = summary.data?.notices ?? [];
  const ctx: HomeCtx = { t, nav };
  const quickCtx: QuickCtx = {
    moduleOn: (key) => tenant.modules.find((m) => m.key === key)?.enabled ?? false,
    canManage,
    attention,
  };
  const quick: QuickItem[] = quickTiles
    .filter((q) => q.visible?.(quickCtx) ?? true)
    .map((q) => ({
      key: q.key,
      icon: q.icon,
      label: q.label(t),
      dot: q.dot?.(quickCtx) ?? false,
      go: () => q.go(nav),
    }));

  return (
    <Screen tabBar refreshing={summary.isRefetching} onRefresh={() => void summary.refetch()}>
      <Reveal order={0}>
        <View className="flex-row items-center gap-3 min-h-[52px]">
          <Press
            onPress={manySocieties ? () => nav.navigate('SocietySwitcher') : undefined}
            disabled={!manySocieties}
            className="flex-1 min-w-0"
            accessibilityRole="button"
          >
            <Text variant="label" tone="secondary" numberOfLines={1}>
              {firstName
                ? `${t(`home:greeting.${greetingKey()}`)}, ${firstName}`
                : t(`home:greeting.${greetingKey()}`)}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Text variant="h2" numberOfLines={1} className="shrink">
                {tenant.society.name}
              </Text>
              {manySocieties ? (
                <Icon name="chevronDown" size={18} color={theme.color.text.secondary} />
              ) : null}
            </View>
          </Press>
          <View className="flex-row gap-2">
            <IconSquare
              icon="search"
              variant="linear"
              onPress={() => nav.navigate('Directory')}
              accessibilityLabel={t('common:actions.search')}
            />
            <IconSquare
              icon="bell"
              dot={(summary.data?.unreadNotifications ?? 0) > 0}
              onPress={() => nav.navigate('Notifications')}
            />
          </View>
        </View>
      </Reveal>

      <Reveal order={1}>
        {summary.isLoading ? (
          <Skeleton className="mt-5 h-[172px] rounded-xl" />
        ) : loadFailed(summary) ? (
          <QueryError query={summary} className="mt-5" />
        ) : (
          <HeroCard hero={hero} next={upcoming[0]} />
        )}
      </Reveal>

      <Reveal order={2}>
        <View className="mt-3 flex-row gap-2.5">
          <HomeTile
            source={photos.notices}
            icon="notices"
            label={t('home:notices')}
            hint={notices[0]?.title ?? t('home:tiles.noticesEmpty')}
            count={notices.filter((n) => !n.readAt).length || undefined}
            onPress={() => nav.navigate('Notices')}
          />
          <HomeTile
            source={upcoming[0]?.kind === 'MEETING' ? photos.meetings : photos.events}
            icon={upcoming[0]?.kind === 'MEETING' ? 'meetings' : 'events'}
            label={t('home:upcoming')}
            hint={upcoming[0] ? upcoming[0].title : t('home:tiles.upcomingEmpty')}
            onPress={() => {
              const u = upcoming[0];
              if (!u) return nav.navigate('Events');
              return u.kind === 'MEETING'
                ? nav.navigate('MeetingDetail', { meetingId: u.id })
                : nav.navigate('EventDetail', { eventId: u.id });
            }}
          />
        </View>
      </Reveal>

      <Reveal order={3}>
        <QuickGrid items={quick} />
      </Reveal>

      {rest.length > 0 ? (
        <Reveal order={5}>
          <SectionHeader title={t('home:needsYou')} />
          <Card tight className="gap-2">
            {rest.map((item) => (
              <AttentionRow key={attentionKey(item)} item={item} ctx={ctx} />
            ))}
          </Card>
        </Reveal>
      ) : null}

      {upcoming.length > 1 ? (
        <Reveal order={6}>
          <SectionHeader title={t('home:upcoming')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-5"
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {upcoming.map((u) => (
              <UpcomingCard key={`${u.kind}-${u.id}`} item={u} wide={false} />
            ))}
          </ScrollView>
        </Reveal>
      ) : null}

      {notices.length > 0 ? (
        <Reveal order={7}>
          <SectionHeader
            title={t('home:notices')}
            actionLabel={t('common:actions.seeAll')}
            onAction={() => nav.navigate('Notices')}
          />
          <Card tight className="gap-2">
            {notices.map((n) => (
              <NoticeRow key={n.id} notice={n} />
            ))}
          </Card>
        </Reveal>
      ) : null}

      {summary.data?.contribution ? (
        <Reveal order={8}>
          <SectionHeader title={t('home:contribution.title')} />
          <Card tight>
            <Row
              icon="rewards"
              title={t('home:contribution.points', { count: summary.data.contribution.points })}
              subtitle={
                summary.data.contribution.openTasks > 0
                  ? t('home:contribution.openTasks', { count: summary.data.contribution.openTasks })
                  : undefined
              }
              onPress={() => nav.navigate('Rewards')}
            />
          </Card>
        </Reveal>
      ) : null}
    </Screen>
  );
}

function UpcomingCard({ item, wide }: { item: UpcomingItem; wide: boolean }) {
  const { t } = useTranslation('home');
  const nav = useNav();
  const meeting = item.kind === 'MEETING';
  return (
    <PhotoCard
      source={meeting ? photos.meetings : photos.events}
      photoHeight={150}
      badge={{ icon: meeting ? 'meetings' : 'events', label: t(`upcomingKind.${item.kind}`) }}
      action={meeting ? <MeetingStatusPill status={item.status} /> : <EventPill event={item} />}
      className={item.status === 'CANCELLED' ? 'opacity-60' : undefined}
      onPress={() =>
        meeting
          ? nav.navigate('MeetingDetail', { meetingId: item.id })
          : nav.navigate('EventDetail', { eventId: item.id })
      }
    >
      <View style={{ width: wide ? undefined : 256 }}>
        <Text variant="h3" numberOfLines={1}>
          {item.title}
        </Text>
        <View className="mt-1.5 flex-row items-center gap-1.5">
          <Icon name="calendar" variant="bold" size={16} color={theme.color.icon.secondary} />
          <Text variant="label" tone="secondary" numberOfLines={1} className="shrink">
            {whenRange(item.startsAt, item.endsAt)}
          </Text>
        </View>
        {item.location ? (
          <View className="mt-1 flex-row items-center gap-1.5">
            <Icon name="location" variant="bold" size={16} color={theme.color.icon.secondary} />
            <Text variant="label" tone="secondary" numberOfLines={1} className="shrink">
              {item.location}
            </Text>
          </View>
        ) : null}
      </View>
    </PhotoCard>
  );
}

function NoticeRow({ notice }: { notice: NoticeSummary }) {
  const { t } = useTranslation('notices');
  const nav = useNav();
  const meta = [notice.isPinned ? t('pinned') : null, relative(notice.publishedAt)]
    .filter(Boolean)
    .join(' · ');
  return (
    <Row
      icon={notice.priority === 'EMERGENCY' ? 'emergency' : 'notices'}
      title={notice.title}
      subtitle={meta}
      trailing={
        <View className="flex-row items-center gap-2">
          {!notice.readAt ? <View className="h-2 w-2 rounded-full bg-ink" /> : null}
          <Icon name="chevronRight" size={20} color={theme.color.text.secondary} />
        </View>
      }
      onPress={() => nav.navigate('NoticeDetail', { noticeId: notice.id })}
    />
  );
}
