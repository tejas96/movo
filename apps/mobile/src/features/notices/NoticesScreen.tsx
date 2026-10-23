import type { NoticeSummary } from '@movo/contracts';
import {
  ArtCard,
  ArtFill,
  Button,
  Chip,
  EmptyState,
  IconSquare,
  MovingIcon,
  Press,
  Rise,
  Screen,
  SectionLabel,
  Skeleton,
  Strong,
  Text,
  theme,
  WaterDrop,
} from '@movo/design-system';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { listItems } from '../../core/api/use-cursor-list';
import { useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { PagedList } from '../../core/ui/PagedList';
import type { StatusTones } from '../../core/ui/StatusPill';
import { relative } from '../../core/util/date';
import { useMarkNoticeRead, useNotice, useNotices } from './api';
import { CATEGORY_LOOK, isThisWeek, matchesFilter, type NoticeFilter } from './look';

/** NORMAL shows no pill. Used by the detail screen. */
export const PRIORITY_TONE: StatusTones<NoticeSummary['priority']> = {
  NORMAL: 'neutral',
  IMPORTANT: 'warning',
  EMERGENCY: 'danger',
};

/** One list entry: a notice and where it sits in its glass group. */
interface Entry {
  notice: NoticeSummary;
  group: string | null;
  first: boolean;
  last: boolean;
}

const keyOf = (e: Entry) => e.notice.id;

/** Soft Glow notice board, laid out like docs/design/soft-glow/source/Notices.dc.html. */
export function NoticesScreen() {
  const { t } = useTranslation(['notices', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const canPublish = useCan('notice.publish');
  const [filter, setFilter] = useState<NoticeFilter>('all');
  const [drafts, setDrafts] = useState(false);
  const list = useNotices(societyId, drafts ? 'DRAFT' : 'PUBLISHED');

  const all = useMemo(() => (list.data ? listItems({ data: list.data }) : []), [list.data]);
  const unread = all.filter((n) => !n.readAt && n.status === 'PUBLISHED').length;
  const categories = [...new Set(all.map((n) => n.category))];
  const pinned = drafts ? undefined : all.find((n) => n.isPinned && matchesFilter(n, filter));

  // Rows: filtered, pinned one taken out, grouped into This week / Earlier. Each row knows if
  // it opens or closes its glass card.
  const select = useCallback(
    (items: NoticeSummary[]): Entry[] => {
      const rest = items.filter((n) => matchesFilter(n, filter) && n.id !== pinned?.id);
      const label = (n: NoticeSummary) =>
        drafts
          ? null
          : isThisWeek(n.publishedAt)
            ? t('notices:glow.thisWeek')
            : t('notices:glow.earlier');
      return rest.map((n, i) => ({
        notice: n,
        group: label(n),
        first: i === 0 || label(rest[i - 1] as NoticeSummary) !== label(n),
        last: i === rest.length - 1 || label(rest[i + 1] as NoticeSummary) !== label(n),
      }));
    },
    [filter, drafts, pinned?.id, t],
  );

  const renderItem = useCallback(({ item }: { item: Entry }) => <NoticeRow entry={item} />, []);

  const header = (
    <View style={styles.header}>
      <Rise>
        <View style={styles.titleRow}>
          <IconSquare
            icon="back"
            variant="linear"
            onPress={() => nav.goBack()}
            accessibilityLabel={t('common:actions.back')}
          />
          <Text variant="greet" className="flex-1" numberOfLines={1}>
            {t('notices:glow.titleA')} <Strong>{t('notices:glow.titleB')}</Strong>
          </Text>
          {unread > 0 ? (
            <View style={styles.newPill}>
              <View style={styles.newDot} />
              <Text variant="label" className="font-medium">
                {t('notices:glow.newCount', { count: unread })}
              </Text>
            </View>
          ) : null}
          {canPublish ? (
            <IconSquare
              icon="add"
              variant="linear"
              tone="ink"
              onPress={() => nav.navigate('NoticeEditor')}
              accessibilityLabel={t('notices:new')}
            />
          ) : null}
        </View>
      </Rise>
      <Rise delay={60}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label={t('notices:glow.all')}
            selected={!drafts && filter === 'all'}
            onPress={() => {
              setDrafts(false);
              setFilter('all');
            }}
          />
          <Chip
            label={t('notices:glow.urgent')}
            selected={!drafts && filter === 'urgent'}
            onPress={() => {
              setDrafts(false);
              setFilter('urgent');
            }}
          />
          {categories.map((c) => (
            <Chip
              key={c}
              label={t(`notices:category.${c}`)}
              selected={!drafts && filter === c}
              onPress={() => {
                setDrafts(false);
                setFilter(c);
              }}
            />
          ))}
          {canPublish ? (
            <Chip
              label={t('notices:drafts')}
              selected={drafts}
              onPress={() => {
                setDrafts(true);
                setFilter('all');
              }}
            />
          ) : null}
        </ScrollView>
      </Rise>
      {list.isLoading ? (
        <View style={styles.loading}>
          <Skeleton className="h-[260px] rounded-rim" />
          <Skeleton className="h-[200px] rounded-[30px]" />
        </View>
      ) : null}
      {pinned ? (
        <Rise delay={120}>
          <PinnedCard notice={pinned} />
        </Rise>
      ) : null}
    </View>
  );

  return (
    <Screen scroll={false}>
      <PagedList
        list={list}
        select={select}
        keyExtractor={keyOf}
        contentContainerStyle={styles.content}
        renderItem={renderItem}
        ListHeaderComponent={header}
        errorClassName="mt-6"
        empty={
          pinned ? (
            <View />
          ) : (
            <EmptyState
              icon="notices"
              title={all.length > 0 ? t('notices:glow.nothing') : t('notices:empty')}
              body={all.length > 0 ? undefined : t('notices:emptyBody')}
              className="mt-6"
            />
          )
        }
      />
    </Screen>
  );
}

/** The pinned notice on its art card, with Got it (mark read) and Open. */
function PinnedCard({ notice }: { notice: NoticeSummary }) {
  const { t } = useTranslation(['notices']);
  const nav = useNav();
  const societyId = useSocietyId();
  const detail = useNotice(societyId, notice.id);
  const markRead = useMarkNoticeRead(societyId);
  const look = CATEGORY_LOOK[notice.category];
  const water = notice.category === 'WATER';
  const read = Boolean(notice.readAt) || markRead.isSuccess;
  const urgent = notice.priority !== 'NORMAL';
  return (
    <ArtCard art={water ? 'water' : 'rose'} fade={0} contentStyle={styles.pinnedContent}>
      <View style={styles.pills}>
        <View style={styles.whitePill}>
          <MovingIcon name="flag" motion="still" size={12} color={theme.color.text.primary} />
          <Text variant="label" className="font-medium">
            {t('notices:pinned')}
          </Text>
        </View>
        {urgent ? (
          <View
            style={[
              styles.solidPill,
              {
                backgroundColor:
                  notice.priority === 'EMERGENCY'
                    ? theme.color.status.danger.fg
                    : theme.color.status.warning.fg,
              },
            ]}
          >
            <Text variant="label" tone="inverse" className="font-medium">
              {t(`notices:priority.${notice.priority}`)}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.pinnedBody}>
        <View style={styles.flex}>
          <Text variant="h2" style={styles.pinnedTitle} numberOfLines={3}>
            {notice.title}
          </Text>
          <Text variant="caption" tone="soft" numberOfLines={1}>
            {[relative(notice.publishedAt), notice.createdBy.displayName].join(' · ')}
          </Text>
          {detail.data?.body ? (
            <Text variant="caption" numberOfLines={4} style={styles.pinnedText}>
              {detail.data.body}
            </Text>
          ) : null}
        </View>
        {water ? (
          <WaterDrop />
        ) : (
          <View style={styles.pinnedIcon}>
            <MovingIcon name={look.icon} motion={look.motion} size={36} color={look.dot} />
          </View>
        )}
      </View>
      {read ? (
        // Already read: one way on, the dark button with the orange arrow.
        <Button
          arrow
          size="md"
          className="mt-3.5"
          label={t('notices:glow.open')}
          onPress={() => nav.navigate('NoticeDetail', { noticeId: notice.id })}
        />
      ) : (
        <View style={styles.actions}>
          <Button
            label={t('notices:glow.gotIt')}
            size="md"
            loading={markRead.isPending}
            className="flex-1"
            onPress={() => markRead.mutate(notice.id)}
          />
          <Button
            label={t('notices:glow.open')}
            variant="white"
            size="md"
            inline
            onPress={() => nav.navigate('NoticeDetail', { noticeId: notice.id })}
          />
        </View>
      )}
    </ArtCard>
  );
}

/** A row inside a glass group: moving category tile, title, category · author, time, dot. */
const NoticeRow = memo(function NoticeRow({ entry }: { entry: Entry }) {
  const { t } = useTranslation(['notices']);
  const nav = useNav();
  const n = entry.notice;
  const look = CATEGORY_LOOK[n.category];
  const unread = !n.readAt && n.status === 'PUBLISHED';
  return (
    <View
      style={[styles.groupPart, entry.first && styles.groupTop, entry.last && styles.groupBottom]}
    >
      {entry.first && entry.group ? <SectionLabel>{entry.group}</SectionLabel> : null}
      <Press
        accessibilityRole="button"
        accessibilityLabel={n.title}
        onPress={() => nav.navigate('NoticeDetail', { noticeId: n.id })}
        scaleTo={0.98}
        style={styles.row}
      >
        <ArtFill art={look.tile} radius={17} fade={0} blur={14} style={styles.tile}>
          <View style={styles.tileIcon}>
            <MovingIcon name={look.icon} motion={look.motion} />
          </View>
        </ArtFill>
        <View style={styles.flex}>
          <View style={styles.rowTop}>
            <Text
              variant="title"
              className={unread ? 'font-semibold' : undefined}
              numberOfLines={1}
              style={styles.flex}
            >
              {n.title}
            </Text>
            <Text variant="micro" tone="secondary" className="font-normal">
              {n.status === 'DRAFT' ? t('notices:draft') : relative(n.publishedAt)}
            </Text>
          </View>
          <View style={styles.rowTop}>
            <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.flex}>
              {t('notices:glow.rowSub', {
                category: t(`notices:category.${n.category}`),
                author: n.createdBy.displayName,
              })}
            </Text>
            {unread ? <View style={styles.unread} /> : null}
          </View>
        </View>
      </Press>
    </View>
  );
});

const GLASS = theme.color.border.glass;

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  content: { paddingBottom: 130 },
  header: { gap: 14, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  newPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.color.bg.nested,
  },
  newDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.color.accent.fg },
  chipsScroll: { marginHorizontal: -theme.layout.gutter },
  chips: { gap: 8, paddingHorizontal: theme.layout.gutter },
  loading: { gap: 14 },
  pills: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  whitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  solidPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
  pinnedContent: { padding: 18 },
  pinnedBody: { flexDirection: 'row', gap: 8, marginTop: 12 },
  pinnedTitle: { fontSize: 22, lineHeight: 28 },
  pinnedText: { marginTop: 10 },
  pinnedIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  groupPart: {
    backgroundColor: theme.color.bg.card,
    borderColor: GLASS,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    paddingHorizontal: 8,
  },
  groupTop: {
    borderTopWidth: 1.5,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 8,
  },
  groupBottom: {
    borderBottomWidth: 1.5,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingBottom: 8,
    marginBottom: 14,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 22 },
  tile: { width: 50, height: 50 },
  tileIcon: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.accent.fg },
});
