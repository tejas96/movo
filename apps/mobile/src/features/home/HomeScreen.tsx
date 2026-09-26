import type { AttentionItem, NoticeSummary } from '@movo/contracts';
import {
  Card,
  Chip,
  HomeTopBar,
  Icon,
  IconSquare,
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
  useCan,
  useMeContext,
  useModuleEnabled,
  useTenant,
} from '../../core/tenant/hooks';
import { greetingKey, relative } from '../../core/util/time';
import { ALERT_ICON } from '../emergency/shared';
import { useHomeSummary } from './api';

export function HomeScreen() {
  const { t } = useTranslation(['home', 'common', 'notices']);
  const nav = useNav();
  const tenant = useTenant();
  const ctx = useMeContext();
  const user = useSessionStore((s) => s.user);
  const summary = useHomeSummary(tenant.society.id);
  const canManage = useCan('member.manage');
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
        <Card tight className="mt-5 gap-2 bg-danger-soft">
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
            onPress={() =>
              nav.navigate('ComingSoon', {
                moduleKey: 'marketplace',
                title: t('home:quick.market'),
              })
            }
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
        <Card className="flex-row items-center gap-4">
          <IconSquare icon="check" tone="white" />
          <View className="flex-1">
            <Text variant="h3">{t('home:allClear')}</Text>
            <Text variant="label" tone="secondary">
              {t('home:allClearBody')}
            </Text>
          </View>
        </Card>
      )}

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
    </Screen>
  );
}

function AttentionRow({ item }: { item: AttentionItem }) {
  const { t } = useTranslation(['home', 'emergency', 'services']);
  const nav = useNav();
  switch (item.type) {
    case 'ACTIVE_ALERT':
      return (
        <Row
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
    default:
      return item.type;
  }
}
