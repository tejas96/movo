import type { AttentionItem, NoticeSummary, UpcomingItem } from '@movo/contracts';
import {
  Card,
  Chip,
  HomeTopBar,
  Icon,
  IconSquare,
  PhotoCard,
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
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
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
  const alerts = attention.filter((a) => a.type === 'ACTIVE_ALERT');
  const others = attention.filter((a) => a.type !== 'ACTIVE_ALERT');
  const manySocieties =
    (ctx.data?.memberships.filter((m) => m.status === 'ACTIVE').length ?? 0) > 1;
  const flats = summary.data?.flats ?? tenant.flats;
  const firstName = user?.displayName.split(' ')[0] ?? '';

  return (
    <Screen tabBar refreshing={summary.isRefetching} onRefresh={() => void summary.refetch()}>
      <HomeTopBar
        icon="building"
        label={
          flats[0]
            ? t('home:flatLabel', { flat: formatFlat(flats[0]) })
            : `${t(`home:greeting.${greetingKey()}`)}, ${firstName}`
        }
        value={tenant.society.name}
        onPressValue={manySocieties ? () => nav.navigate('SocietySwitcher') : undefined}
        trailing={
          <IconSquare
            icon="bell"
            dot={(summary.data?.unreadNotifications ?? 0) > 0}
            onPress={() => nav.navigate('Notifications')}
          />
        }
      />
      {alerts.length > 0 ? (
        <Card tight className="mt-5 gap-2">
          {alerts.map((item) => (
            <AttentionRow key={attentionKey(item)} item={item} />
          ))}
        </Card>
      ) : null}
      <SearchBar
        className="mt-5"
        placeholder={t('home:searchPlaceholder')}
        onPressOpen={() => nav.navigate('Directory')}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-4 -mx-5"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
      >
        {services ? (
          <Chip
            label={t('home:quick.services')}
            icon="services"
            onPress={() => nav.navigate('Services')}
          />
        ) : null}
        <Chip
          label={t('home:quick.directory')}
          icon="directory"
          onPress={() => nav.navigate('Directory')}
        />
        {emergency ? (
          <Chip
            label={t('home:quick.emergency')}
            icon="emergency"
            onPress={() => nav.navigate('Emergency')}
          />
        ) : null}
        {market ? (
          <Chip
            label={t('home:quick.market')}
            icon="market"
            onPress={() => nav.navigate('Tabs', { screen: 'Market' })}
          />
        ) : canManage ? (
          <Chip
            label={t('home:quick.manage')}
            icon="settings"
            onPress={() => nav.navigate('Manage')}
          />
        ) : null}
      </ScrollView>

      {others.length > 0 || alerts.length === 0 ? (
        <SectionHeader title={t('home:needsYou')} />
      ) : null}
      {summary.isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : others.length > 0 ? (
        <Card tight className="gap-2">
          {others.map((item) => (
            <AttentionRow key={attentionKey(item)} item={item} />
          ))}
        </Card>
      ) : alerts.length > 0 ? null : (
        <PhotoCard
          source={photos.society2}
          photoHeight={150}
          badge={{ icon: 'check', label: t('home:allClear') }}
        >
          <Text variant="body" tone="secondary">
            {t('home:allClearBody')}
          </Text>
        </PhotoCard>
      )}

      {summary.data && summary.data.upcoming.length > 0 ? (
        <>
          <SectionHeader title={t('home:upcoming')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-5"
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {summary.data.upcoming.map((u) => (
              <UpcomingCard
                key={`${u.kind}-${u.id}`}
                item={u}
                wide={summary.data?.upcoming.length === 1}
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      {summary.data && summary.data.notices.length > 0 ? (
        <>
          <SectionHeader
            title={t('home:notices')}
            actionLabel={t('common:actions.seeAll')}
            onAction={() => nav.navigate('Notices')}
          />
          <Card tight className="gap-2">
            {summary.data.notices.map((n) => (
              <NoticeRow key={n.id} notice={n} />
            ))}
          </Card>
        </>
      ) : null}
      {summary.data?.contribution ? (
        <>
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
        </>
      ) : null}
    </Screen>
  );
}

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
