import {
  Chip,
  Glass,
  IconSquare,
  Rise,
  Row,
  Screen,
  SearchBar,
  SectionLabel,
  Skeleton,
} from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSessionStore } from '../../core/auth/session.store';
import { useHomeSummary } from '../../core/home/api';
import type { HomeCtx, QuickCtx } from '../../core/home/types';
import { useMembers } from '../../core/members/api';
import { useMyDues } from '../../core/money/api';
import { useNav } from '../../core/navigation/types';
import { useSocietyProfile } from '../../core/society/api';
import { formatFlat, useCanManageSociety, useMeContext, useTenant } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { money } from '../../core/util/money';
import {
  DuesCard,
  GreetingCard,
  HomeCard,
  type HomeStatus,
  MembersCard,
  NextUpPill,
  NoticesCard,
  ShortcutTiles,
} from './cards';
import { initialsOf, ringMonths } from './dues-ring';
import { attentionKey, quickTiles } from './registry';
import { AttentionRow, QuickActions, type QuickItem } from './tiles';

/** Rise delay between cards, as in the mockup (0.06 s apart). */
const STEP = 60;

/** Soft Glow Home, laid out like docs/design/soft-glow/source/Main.dc.html. */
export function HomeScreen() {
  const { t } = useTranslation(['home', 'common', 'notices', 'me']);
  const nav = useNav();
  const tenant = useTenant();
  const me = useMeContext();
  const user = useSessionStore((s) => s.user);
  const societyId = tenant.society.id;
  const summary = useHomeSummary(societyId);
  const canManage = useCanManageSociety();
  const moduleOn = (key: string) => tenant.modules.find((m) => m.key === key)?.enabled ?? false;
  const maintenance = moduleOn('maintenance');
  const dues = useMyDues(societyId, maintenance);
  const profile = useSocietyProfile(societyId);
  const members = useMembers(societyId, '');

  const attention = summary.data?.attention ?? [];
  const upcoming = summary.data?.upcoming ?? [];
  const notices = summary.data?.notices ?? [];
  const myFlat = summary.data?.flats[0];
  const manySocieties = (me.data?.memberships.filter((m) => m.status === 'ACTIVE').length ?? 0) > 1;
  const firstName = user?.displayName.split(' ')[0] ?? '';
  const ctx: HomeCtx = { t, nav };

  // Facts on the greeting card: notices, dues, alerts. All real, never made up.
  const unread = notices.filter((n) => !n.readAt).length;
  const alerts = attention.filter((a) => a.type === 'ACTIVE_ALERT');
  const accounts = dues.data?.flats ?? [];
  const outstanding = accounts.reduce((sum, f) => sum + f.outstandingPaise, 0);
  const overdue = accounts.some((f) => f.overdue);
  const facts = [
    unread > 0
      ? t('home:glow.facts.newNotices', { count: unread })
      : t('home:glow.facts.noNotices'),
    ...(maintenance
      ? [
          outstanding > 0
            ? t('home:glow.facts.due', { amount: money(outstanding) })
            : t('home:glow.facts.allPaid'),
        ]
      : []),
    alerts.length > 0
      ? t('home:glow.facts.alerts', { count: alerts.length })
      : t('home:glow.facts.noAlerts'),
  ];

  // The building card: its status and where a tap goes.
  const status: HomeStatus = alerts.length > 0 ? 'alert' : overdue ? 'overdue' : 'good';
  const openHome = () => {
    const alert = alerts[0];
    if (alert) return nav.navigate('AlertDetail', { alertId: alert.alertId });
    if (maintenance && myFlat) return nav.navigate('FlatAccount', { flatId: myFlat.id });
    return nav.navigate('Tabs', { screen: 'Society' });
  };
  const homeDetail = myFlat
    ? [t(`common:relation.${myFlat.relation}`), tenant.society.name].join(' · ')
    : tenant.society.name;

  // The dues ring: this financial year, open monthly bills in pink.
  const openBills = accounts.flatMap((f) => f.openBills);
  const segments = ringMonths(
    profile.data?.fyStartMonth ?? 4,
    openBills.map((b) => b.periodKey),
    outstanding > 0,
  );
  const nextDue = accounts
    .map((f) => f.nextDueDate)
    .filter((d): d is string => Boolean(d))
    .sort()[0];

  // Members: counts from the society profile, faces from the first three members.
  const counts = profile.data?.counts;
  const faces = (members.data?.pages.flatMap((p) => p.items) ?? []).slice(0, 3).map((m) => ({
    id: m.membershipId,
    initials: initialsOf(m.displayName),
  }));
  const moreFaces =
    counts && counts.members > faces.length ? `+${counts.members - faces.length}` : undefined;
  const membersSub = counts
    ? t('home:glow.members.sub', { flats: counts.flats, people: counts.members })
    : t('home:quick.directory');

  // Everything that needs the user, except dues, which the Maintenance card already shows.
  const needs = attention.filter((a) => !(maintenance && a.type === 'DUES'));

  // Shortcuts not already on a card above (Members and Find my way are cards).
  const quickCtx: QuickCtx = { moduleOn, canManage, attention };
  const quick: QuickItem[] = quickTiles
    .filter((q) => q.key !== 'ar' && q.key !== 'directory')
    .filter((q) => q.visible?.(quickCtx) ?? true)
    .map((q) => ({
      key: q.key,
      icon: q.icon,
      label: q.label(t),
      dot: q.dot?.(quickCtx) ?? false,
      go: () => q.go(nav),
    }));

  // Cards rise one after another in the order they appear.
  let order = 0;
  const next = () => {
    order += 1;
    return order * STEP;
  };

  return (
    <Screen
      tabBar
      glow="home"
      refreshing={summary.isRefetching}
      onRefresh={() => {
        void summary.refetch();
        void dues.refetch();
      }}
    >
      <View style={styles.stack}>
        <Rise>
          <View style={styles.header}>
            <SearchBar
              className="flex-1"
              placeholder={t('home:glow.searchHint')}
              onPressOpen={() => nav.navigate('Directory')}
            />
            <IconSquare
              icon="bell"
              variant="linear"
              dot={(summary.data?.unreadNotifications ?? 0) > 0}
              onPress={() => nav.navigate('Notifications')}
              accessibilityLabel={t('me:notifications')}
            />
            <IconSquare
              icon="user"
              variant="linear"
              onPress={() => nav.navigate('Tabs', { screen: 'Me' })}
              accessibilityLabel={t('home:glow.profile')}
            />
          </View>
        </Rise>

        <Rise delay={next()}>
          <View style={styles.chips}>
            <Chip label={t('home:glow.chips.today')} selected />
            {maintenance && myFlat ? (
              <Chip
                label={t('home:glow.chips.myFlat')}
                onPress={() => nav.navigate('FlatAccount', { flatId: myFlat.id })}
              />
            ) : null}
            <Chip
              label={t('home:glow.chips.society')}
              onPress={() => nav.navigate('Tabs', { screen: 'Society' })}
            />
          </View>
        </Rise>

        <Rise delay={next()}>
          <GreetingCard
            society={tenant.society.name}
            onSwitch={manySocieties ? () => nav.navigate('SocietySwitcher') : undefined}
            firstName={firstName}
            facts={summary.data ? facts : []}
          />
        </Rise>

        {summary.isLoading ? (
          <Skeleton className="h-[214px] rounded-rim" />
        ) : loadFailed(summary) ? (
          <QueryError query={summary} />
        ) : null}

        {upcoming[0] ? (
          <Rise delay={next()}>
            <NextUpPill item={upcoming[0]} />
          </Rise>
        ) : null}

        {summary.data ? (
          <Rise delay={next()}>
            <HomeCard
              flat={myFlat ? formatFlat(myFlat) : tenant.society.name}
              pin={myFlat?.number ?? ''}
              detail={homeDetail}
              status={status}
              onPress={openHome}
            />
          </Rise>
        ) : null}

        {maintenance && dues.data && accounts.length > 0 ? (
          <Rise delay={next()}>
            <DuesCard
              outstandingPaise={outstanding}
              overdue={overdue}
              nextDueDate={nextDue ?? null}
              openBills={openBills.length}
              segments={segments}
              onPay={() => nav.navigate('Tabs', { screen: 'Money' })}
            />
          </Rise>
        ) : null}

        <Rise delay={next()}>
          <NoticesCard
            unread={unread}
            latest={notices[0]}
            onPress={() => nav.navigate('Notices')}
          />
        </Rise>

        <Rise delay={next()}>
          <ShortcutTiles
            onBills={maintenance ? () => nav.navigate('Tabs', { screen: 'Money' }) : undefined}
            onFindWay={() => nav.navigate('AR')}
          />
        </Rise>

        <Rise delay={next()}>
          <MembersCard
            people={faces}
            more={moreFaces}
            sub={membersSub}
            onPress={() => nav.navigate('Directory')}
          />
        </Rise>

        {needs.length > 0 ? (
          <Rise delay={next()}>
            <Glass radius={28} style={styles.list}>
              <SectionLabel>{t('home:needsYou')}</SectionLabel>
              {needs.map((item) => (
                <AttentionRow key={attentionKey(item)} item={item} ctx={ctx} />
              ))}
            </Glass>
          </Rise>
        ) : null}

        <Rise delay={next()}>
          <QuickActions title={t('home:glow.more')} items={quick} />
        </Rise>

        {summary.data?.contribution ? (
          <Rise delay={next()}>
            <Row
              icon="rewards"
              title={t('home:contribution.points', { count: summary.data.contribution.points })}
              subtitle={
                summary.data.contribution.openTasks > 0
                  ? t('home:contribution.openTasks', {
                      count: summary.data.contribution.openTasks,
                    })
                  : undefined
              }
              onPress={() => nav.navigate('Rewards')}
            />
          </Rise>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  list: { padding: 8 },
});
