import type { AttentionItem, NoticeSummary, UpcomingItem } from '@movo/contracts';
import {
  Button,
  Card,
  Icon,
  type IconName,
  IconSquare,
  PhotoCard,
  PhotoTile,
  Press,
  photos,
  Row,
  Screen,
  SearchBar,
  SectionHeader,
  Skeleton,
  StatusPill,
  Text,
  theme,
} from '@movo/design-system';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSessionStore } from '../../core/auth/session.store';
import { useNav } from '../../core/navigation/types';
import {
  formatFlat,
  useCanManageSociety,
  useMeContext,
  useModuleEnabled,
  useTenant,
} from '../../core/tenant/hooks';
import { day, money } from '../../core/util/money';
import { greetingKey, relative, whenRange } from '../../core/util/time';
import { ALERT_ICON } from '../emergency/shared';
import { EventPill } from '../events/EventsScreen';
import { MeetingStatusPill } from '../meetings/MeetingsScreen';
import { useHomeSummary } from './api';

export function HomeScreen() {
  const { t } = useTranslation(['home', 'common', 'notices']);
  const nav = useNav();
  const tenant = useTenant();
  const ctx = useMeContext();
  const user = useSessionStore((s) => s.user);
  const summary = useHomeSummary(tenant.society.id);
  const canManage = useCanManageSociety();
  const market = useModuleEnabled('marketplace');
  const services = useModuleEnabled('vendors');
  const emergency = useModuleEnabled('emergency');
  const attention = summary.data?.attention ?? [];
  const manySocieties =
    (ctx.data?.memberships.filter((m) => m.status === 'ACTIVE').length ?? 0) > 1;
  const firstName = user?.displayName.split(' ')[0] ?? '';

  // One thing on the black card; everything else stays in the "Needs you" rows.
  const hero = pickHero(attention);
  const rest = attention.filter((a) => a !== hero);
  const upcoming = summary.data?.upcoming ?? [];
  const notices = summary.data?.notices ?? [];
  const hasAlert = attention.some((a) => a.type === 'ACTIVE_ALERT');

  const quick: { key: string; icon: IconName; label: string; dot?: boolean; go: () => void }[] = [
    {
      key: 'directory',
      icon: 'directory',
      label: t('home:quick.directory'),
      go: () => nav.navigate('Directory'),
    },
    ...(services
      ? [
          {
            key: 'services',
            icon: 'services' as IconName,
            label: t('home:quick.services'),
            go: () => nav.navigate('Services'),
          },
        ]
      : []),
    ...(emergency
      ? [
          {
            key: 'emergency',
            icon: 'emergency' as IconName,
            label: t('home:quick.emergency'),
            dot: hasAlert,
            go: () => nav.navigate('Emergency'),
          },
        ]
      : []),
    { key: 'ar', icon: 'map', label: t('home:quick.ar'), go: () => nav.navigate('AR') },
    ...(market
      ? [
          {
            key: 'market',
            icon: 'market' as IconName,
            label: t('home:quick.market'),
            go: () => nav.navigate('Tabs', { screen: 'Market' }),
          },
        ]
      : canManage
        ? [
            {
              key: 'manage',
              icon: 'settings' as IconName,
              label: t('home:quick.manage'),
              go: () => nav.navigate('Manage'),
            },
          ]
        : []),
  ];

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
          <IconSquare
            icon="bell"
            dot={(summary.data?.unreadNotifications ?? 0) > 0}
            onPress={() => nav.navigate('Notifications')}
          />
        </View>
      </Reveal>

      <Reveal order={1}>
        {summary.isLoading ? (
          <Skeleton className="mt-5 h-[172px] rounded-xl" />
        ) : (
          <HeroCard hero={hero} next={upcoming[0]} />
        )}
      </Reveal>

      <Reveal order={2}>
        <View className="mt-3 flex-row gap-2.5">
          <PhotoTile
            source={photos.notices}
            icon="notices"
            label={t('home:notices')}
            hint={notices[0]?.title ?? t('home:tiles.noticesEmpty')}
            count={notices.filter((n) => !n.readAt).length || undefined}
            onPress={() => nav.navigate('Notices')}
          />
          <PhotoTile
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

      <Reveal order={4}>
        <SearchBar
          className="mt-5"
          placeholder={t('home:searchPlaceholder')}
          onPressOpen={() => nav.navigate('Directory')}
        />
      </Reveal>

      {rest.length > 0 ? (
        <Reveal order={5}>
          <SectionHeader title={t('home:needsYou')} />
          <Card tight className="gap-2">
            {rest.map((item) => (
              <AttentionRow key={attentionKey(item)} item={item} />
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

/** Sections fade and rise once, 50 ms apart, the first time Home mounts. */
function Reveal({ order, children }: { order: number; children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(360).delay(order * 50)}>{children}</Animated.View>
  );
}

const HERO_PRIORITY: AttentionItem['type'][] = ['ACTIVE_ALERT', 'DUES', 'MY_DUTY', 'MY_TASK'];

function pickHero(items: AttentionItem[]): AttentionItem | undefined {
  for (const type of HERO_PRIORITY) {
    const hit = items.find((i) => i.type === type);
    if (hit) return hit;
  }
  return undefined;
}

/** The one black surface on Home: what matters most right now, with its action. */
function HeroCard({
  hero,
  next,
}: {
  hero: AttentionItem | undefined;
  next: UpcomingItem | undefined;
}) {
  const { t } = useTranslation(['home', 'emergency', 'money']);
  const nav = useNav();
  let label = '';
  let value: ReactNode = null;
  let caption: string | undefined;
  let cta: { label: string; go: () => void } | undefined;

  switch (hero?.type) {
    case 'ACTIVE_ALERT':
      label = t('home:hero.alert.label');
      value = t('home:attention.ACTIVE_ALERT.title', {
        type: t(`emergency:type.${hero.alertType}`),
      });
      caption = t('home:attention.ACTIVE_ALERT.sub', {
        place: hero.flat ? formatFlat(hero.flat) : t('emergency:societyPlace'),
        time: relative(hero.createdAt),
      });
      cta = {
        label: t('home:hero.alert.cta'),
        go: () => nav.navigate('AlertDetail', { alertId: hero.alertId }),
      };
      break;
    case 'DUES': {
      label = `${t('home:hero.dues.label')} · ${formatFlat(hero.flat)}`;
      value = <CountUp paise={hero.amountPaise} />;
      const daysLeft = Math.ceil((Date.parse(hero.dueDate) - Date.now()) / 86_400_000);
      caption = hero.overdue
        ? t('home:hero.dues.overdue', { date: day(hero.dueDate, 'short') })
        : t('home:hero.dues.dueIn', {
            date: day(hero.dueDate, 'short'),
            count: Math.max(0, daysLeft),
          });
      cta = { label: t('home:hero.dues.cta'), go: () => nav.navigate('Tabs', { screen: 'Money' }) };
      break;
    }
    case 'MY_DUTY':
      label = t('home:hero.duty.label');
      value = hero.title;
      caption = t('home:attention.MY_DUTY.sub', { date: day(hero.periodEnd, 'short') });
      cta = {
        label: hero.canConfirm ? t('home:attention.MY_DUTY.markDone') : t('home:hero.duty.cta'),
        go: () => nav.navigate('DutyDetail', { dutyId: hero.dutyId }),
      };
      break;
    case 'MY_TASK':
      label = t('home:hero.task.label');
      value = hero.title;
      caption = hero.dueOn
        ? t('home:attention.MY_TASK.sub', { date: day(hero.dueOn, 'short') })
        : undefined;
      cta = {
        label: t('home:hero.task.cta'),
        go: () => nav.navigate('TaskDetail', { taskId: hero.taskId }),
      };
      break;
    default:
      label = t('home:hero.clear.label');
      value = t('home:allClearBody');
      caption = next
        ? t('home:hero.clear.next', {
            title: next.title,
            when: whenRange(next.startsAt, next.endsAt),
          })
        : undefined;
      cta = next
        ? {
            label: t('home:hero.clear.cta'),
            go: () =>
              next.kind === 'MEETING'
                ? nav.navigate('MeetingDetail', { meetingId: next.id })
                : nav.navigate('EventDetail', { eventId: next.id }),
          }
        : undefined;
  }

  const danger = hero?.type === 'ACTIVE_ALERT';
  return (
    <View style={styles.hero} className="mt-5">
      <View className="flex-row items-center gap-2">
        {danger ? <StatusPill label={t('emergency:status.ACTIVE')} tone="danger" dot /> : null}
        <Text variant="label" style={styles.heroDim} numberOfLines={1} className="shrink">
          {label}
        </Text>
      </View>
      {typeof value === 'string' ? (
        <Text variant="h2" tone="inverse" numberOfLines={2} className="mt-2">
          {value}
        </Text>
      ) : (
        <View className="mt-2">{value}</View>
      )}
      {caption ? (
        <Text variant="caption" style={styles.heroDim} numberOfLines={2} className="mt-1">
          {caption}
        </Text>
      ) : null}
      {cta ? (
        <View className="mt-4 flex-row">
          <Button label={cta.label} variant="white" size="sm" inline onPress={cta.go} />
        </View>
      ) : null}
    </View>
  );
}

/** Rupees rolling from zero to the amount, once, when the card appears. */
function CountUp({ paise }: { paise: number }) {
  const [shown, setShown] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) {
      setShown(paise);
      return;
    }
    done.current = true;
    const start = Date.now();
    const ms = 900;
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / ms);
      const eased = 1 - (1 - p) ** 3;
      setShown(Math.round(paise * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [paise]);
  return (
    <Text variant="display" tone="inverse" style={styles.amount}>
      {money(shown)}
    </Text>
  );
}

function QuickGrid({
  items,
}: {
  items: { key: string; icon: IconName; label: string; dot?: boolean; go: () => void }[];
}) {
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
          <Text variant="micro" center numberOfLines={2} className="font-medium">
            {q.label}
          </Text>
        </Press>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: theme.color.bg.ink, borderRadius: theme.radius.xl, padding: 20 },
  heroDim: { color: 'rgba(255, 255, 255, 0.62)' },
  amount: { fontVariant: ['tabular-nums'] },
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

function AttentionRow({ item }: { item: AttentionItem }) {
  const { t } = useTranslation(['home', 'emergency', 'services', 'money']);
  const nav = useNav();
  switch (item.type) {
    case 'ACTIVE_ALERT':
      return (
        <Row
          tone="danger"
          icon={ALERT_ICON[item.alertType]}
          title={t('home:attention.ACTIVE_ALERT.title', {
            type: t(`emergency:type.${item.alertType}`),
          })}
          subtitle={t('home:attention.ACTIVE_ALERT.sub', {
            place: item.flat ? formatFlat(item.flat) : t('emergency:societyPlace'),
            time: relative(item.createdAt),
          })}
          trailing={<StatusPill label={t('emergency:status.ACTIVE')} tone="danger" dot />}
          onPress={() => nav.navigate('AlertDetail', { alertId: item.alertId })}
        />
      );
    case 'DUES':
      return (
        <Row
          icon="wallet"
          title={t(
            item.overdue ? 'home:attention.DUES.titleOverdue' : 'home:attention.DUES.title',
            {
              amount: money(item.amountPaise),
              flat: formatFlat(item.flat),
            },
          )}
          subtitle={t('home:attention.DUES.sub', { date: day(item.dueDate, 'short') })}
          trailing={
            item.overdue ? (
              <StatusPill label={t('money:status.OVERDUE')} tone="danger" />
            ) : undefined
          }
          onPress={() => nav.navigate('Tabs', { screen: 'Money' })}
        />
      );
    case 'MY_DUTY':
      return (
        <Row
          icon="duties"
          title={t('home:attention.MY_DUTY.title', { title: item.title })}
          subtitle={t('home:attention.MY_DUTY.sub', { date: day(item.periodEnd, 'short') })}
          trailing={
            item.canConfirm ? (
              <StatusPill label={t('home:attention.MY_DUTY.markDone')} tone="ink" />
            ) : undefined
          }
          onPress={() => nav.navigate('DutyDetail', { dutyId: item.dutyId })}
        />
      );
    case 'MY_TASK':
      return (
        <Row
          icon="tasks"
          title={item.title}
          subtitle={
            item.dueOn
              ? t('home:attention.MY_TASK.sub', { date: day(item.dueOn, 'short') })
              : t('home:attention.MY_TASK.subNoDue')
          }
          trailing={
            item.returned ? (
              <StatusPill label={t('home:attention.MY_TASK.returned')} tone="warning" />
            ) : undefined
          }
          onPress={() => nav.navigate('TaskDetail', { taskId: item.taskId })}
        />
      );
    case 'TASKS_TO_VERIFY':
      return (
        <Row
          icon="taskDone"
          title={t('home:attention.TASKS_TO_VERIFY.title', { count: item.count })}
          subtitle={t('home:attention.TASKS_TO_VERIFY.sub')}
          onPress={() => nav.navigate('Tasks', { view: 'TO_VERIFY' })}
        />
      );
    case 'EXPENSES_TO_APPROVE':
      return (
        <Row
          icon="receipt"
          title={t('home:attention.EXPENSES_TO_APPROVE.title', { count: item.count })}
          subtitle={t('home:attention.EXPENSES_TO_APPROVE.sub', {
            amount: money(item.amountPaise),
          })}
          onPress={() => nav.navigate('Expenses', { status: 'PENDING' })}
        />
      );
    case 'VENDOR_SUGGESTIONS':
      return (
        <Row
          icon="services"
          title={t('home:attention.VENDOR_SUGGESTIONS.title', { count: item.count })}
          subtitle={t('home:attention.VENDOR_SUGGESTIONS.sub')}
          onPress={() =>
            nav.navigate('VendorList', {
              status: 'SUGGESTED',
              title: t('services:status.SUGGESTED'),
            })
          }
        />
      );
    case 'MARKET_ORDERS_WAITING':
      return (
        <Row
          icon="market"
          title={t('home:attention.MARKET_ORDERS_WAITING.title', { count: item.count })}
          subtitle={t('home:attention.MARKET_ORDERS_WAITING.sub')}
          onPress={() => nav.navigate('Orders', { role: 'SELLING' })}
        />
      );
    case 'JOIN_REQUESTS_PENDING':
      return (
        <Row
          icon="userAdd"
          title={t('attention.JOIN_REQUESTS_PENDING.title', { count: item.count })}
          subtitle={t('attention.JOIN_REQUESTS_PENDING.sub')}
          onPress={() => nav.navigate('JoinRequests')}
        />
      );
    case 'INVITATIONS_PENDING':
      return (
        <Row
          icon="send"
          title={t('attention.INVITATIONS_PENDING.title', { count: item.count })}
          subtitle={t('attention.INVITATIONS_PENDING.sub')}
          onPress={() => nav.navigate('Invitations')}
        />
      );
    case 'IMPORTANT_NOTICE':
      return (
        <Row
          icon={item.priority === 'EMERGENCY' ? 'emergency' : 'notices'}
          title={item.title}
          subtitle={t('attention.IMPORTANT_NOTICE.sub')}
          onPress={() => nav.navigate('NoticeDetail', { noticeId: item.noticeId })}
        />
      );
    case 'PROFILE_INCOMPLETE':
      return (
        <Row
          icon="mail"
          title={t('attention.PROFILE_INCOMPLETE.title')}
          subtitle={t('attention.PROFILE_INCOMPLETE.sub')}
          onPress={() => nav.navigate('EditProfile')}
        />
      );
    default:
      return null;
  }
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

function attentionKey(item: AttentionItem): string {
  switch (item.type) {
    case 'IMPORTANT_NOTICE':
      return `${item.type}-${item.noticeId}`;
    case 'ACTIVE_ALERT':
      return `${item.type}-${item.alertId}`;
    case 'PROFILE_INCOMPLETE':
      return `${item.type}-${item.missing.join(',')}`;
    case 'DUES':
      return `${item.type}-${item.flat.id}`;
    case 'MY_DUTY':
      return `${item.type}-${item.assignmentId}`;
    case 'MY_TASK':
      return `${item.type}-${item.taskId}`;
    default:
      return item.type;
  }
}
