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
        <Chip
          label={t('home:quick.services')}
          icon="services"
          onPress={() =>
            nav.navigate('ComingSoon', { moduleKey: 'vendors', title: t('home:quick.services') })
          }
        />
        <Chip
          label={t('home:quick.directory')}
          icon="directory"
          onPress={() => nav.navigate('Directory')}
        />
        <Chip
          label={t('home:quick.emergency')}
          icon="emergency"
          onPress={() =>
            nav.navigate('ComingSoon', { moduleKey: 'emergency', title: t('home:quick.emergency') })
          }
        />
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

      <SectionHeader title={t('home:needsYou')} />
      {summary.isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : summary.data && summary.data.attention.length > 0 ? (
        <Card tight className="gap-2">
          {summary.data.attention.map((item) => (
            <AttentionRow key={attentionKey(item)} item={item} />
          ))}
        </Card>
      ) : (
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
  const { t } = useTranslation('home');
  const nav = useNav();
  switch (item.type) {
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
    case 'PROFILE_INCOMPLETE':
      return `${item.type}-${item.missing.join(',')}`;
    default:
      return item.type;
  }
}
