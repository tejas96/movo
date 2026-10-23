import type { MemberCard } from '@movo/contracts';
import {
  Chip,
  EmptyState,
  Glass,
  GlowAvatar,
  Icon,
  IconSquare,
  initialsOf,
  Press,
  Rise,
  Screen,
  SearchBar,
  SectionLabel,
  Skeleton,
  StatusPill,
  Text,
  theme,
  toneFor,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, Text as RNText, ScrollView, StyleSheet, View } from 'react-native';
import { photoUri } from '../../core/api/client';
import { listItems } from '../../core/api/use-cursor-list';
import { useSessionStore } from '../../core/auth/session.store';
import { useMembers } from '../../core/members/api';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useBuildings, useSocietyProfile } from '../../core/society/api';
import { formatFlat, useSocietyId } from '../../core/tenant/hooks';
import { PagedList } from '../../core/ui/PagedList';

/** Roles shown on the committee strip, as on the Society hub. */
const COMMITTEE_ROLES = new Set(['admin', 'committee', 'treasurer']);

/**
 * The Everyone card is one list item holding every loaded row. Separate glass parts per row
 * leave hairline seams on Android where their soft edges meet.
 */
const keyOf = () => 'everyone';

/** A round face: the photo when there is one, else glowing initials. */
function Face({ member, size, pulse }: { member: MemberCard; size: number; pulse?: boolean }) {
  const uri = photoUri(member.avatarUrl);
  if (uri)
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityLabel={member.displayName}
      />
    );
  return (
    <GlowAvatar
      initials={initialsOf(member.displayName)}
      size={size}
      tone={toneFor(member.membershipId)}
      pulse={pulse}
    />
  );
}

const MemberRow = memo(function MemberRow({
  member: m,
  manage,
  meId,
}: {
  member: MemberCard;
  manage: boolean;
  meId: string | undefined;
}) {
  const { t } = useTranslation(['society', 'common']);
  const nav = useNav();
  const flat = m.flats[0];
  const note = [
    flat ? t(`common:relation.${flat.relation}`) : m.isStaff ? t('society:directory.staff') : null,
    m.userId === meId ? t('society:directory.glow.you') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const where = [m.flats.map(formatFlat).join(', '), note].filter(Boolean);
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={m.displayName}
      onPress={() => nav.navigate('MemberDetail', { membershipId: m.membershipId })}
      scaleTo={0.98}
      style={styles.row}
    >
      <Face member={m} size={46} />
      <View className="flex-1 min-w-0">
        <Text variant="title" numberOfLines={1}>
          {m.displayName}
        </Text>
        <Text variant="label" tone="secondary" numberOfLines={1}>
          {where.map((w, i) => (
            <RNText key={w}>
              {i > 0 ? <RNText style={styles.bar}>{' | '}</RNText> : null}
              {w}
            </RNText>
          ))}
        </Text>
      </View>
      {manage && m.status !== 'ACTIVE' ? (
        <StatusPill label={t(`common:status.${m.status}`)} tone="neutral" />
      ) : m.phone ? (
        <Press
          accessibilityRole="button"
          accessibilityLabel={t('society:directory.glow.call', { name: m.displayName })}
          onPress={() => void Linking.openURL(`tel:${m.phone}`)}
          scaleTo={0.92}
          style={styles.call}
        >
          <Icon name="call" size={17} color={theme.color.accent.fg} />
        </Press>
      ) : null}
    </Press>
  );
});

/** Soft Glow members list, laid out like docs/design/soft-glow/source/Members.dc.html. */
export function DirectoryScreen() {
  const { t } = useTranslation(['society', 'common', 'manage', 'home']);
  const nav = useNav();
  const societyId = useSocietyId();
  const meId = useSessionStore((s) => s.user?.id);
  const manage = Boolean(useRoute<RouteProp<RootStackParamList, 'Directory'>>().params?.manage);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);
  const [buildingId, setBuildingId] = useState<string | undefined>(undefined);
  const wings = useBuildings(societyId).data ?? [];
  const counts = useSocietyProfile(societyId).data?.counts;
  const list = useMembers(societyId, q, buildingId);

  // Committee strip: only on the full list, from the members already loaded.
  const all = useMemo(() => (list.data ? listItems({ data: list.data }) : []), [list.data]);
  const committee =
    q || buildingId ? [] : all.filter((m) => m.roles.some((r) => COMMITTEE_ROLES.has(r.key)));

  const select = useCallback(
    (items: MemberCard[]): MemberCard[][] => (items.length > 0 ? [items] : []),
    [],
  );
  const renderItem = useCallback(
    ({ item }: { item: MemberCard[] }) => (
      <Rise delay={200}>
        <Glass radius={28} style={styles.list}>
          <SectionLabel>{t('society:directory.glow.everyone')}</SectionLabel>
          {item.map((m) => (
            <MemberRow key={m.membershipId} member={m} manage={manage} meId={meId} />
          ))}
        </Glass>
      </Rise>
    ),
    [manage, meId, t],
  );

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
          <Text variant="h1" className="flex-1" numberOfLines={1}>
            {manage ? t('manage:members') : t('society:directory.glow.title')}
          </Text>
          {counts ? (
            <Text variant="caption" tone="secondary">
              {t('home:glow.members.sub', { flats: counts.flats, people: counts.members })}
            </Text>
          ) : null}
        </View>
      </Rise>
      <Rise delay={60}>
        <SearchBar
          placeholder={t('society:directory.glow.search')}
          value={text}
          onChangeText={setText}
          autoFocus={false}
        />
      </Rise>
      {wings.length > 1 ? (
        <Rise delay={100}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.chips}
            keyboardShouldPersistTaps="handled"
          >
            <Chip
              label={t('society:directory.allWings')}
              selected={!buildingId}
              onPress={() => setBuildingId(undefined)}
            />
            {wings.map((b) => (
              <Chip
                key={b.id}
                label={b.name}
                selected={buildingId === b.id}
                onPress={() => setBuildingId(b.id)}
              />
            ))}
          </ScrollView>
        </Rise>
      ) : null}
      {committee.length > 0 ? (
        <Rise delay={140}>
          <SectionLabel className="px-1 pt-1 pb-2.5">{t('society:committee')}</SectionLabel>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipsScroll}
            contentContainerStyle={styles.committee}
          >
            {committee.map((m, i) => (
              <Glass
                key={m.membershipId}
                radius={28}
                style={styles.committeeCard}
                onPress={() => nav.navigate('MemberDetail', { membershipId: m.membershipId })}
                accessibilityLabel={m.displayName}
              >
                <View style={{ marginBottom: 2 }}>
                  <CommitteeFace member={m} delay={i * 600} />
                </View>
                <Text variant="bodyMedium" className="text-center" numberOfLines={2}>
                  {m.displayName}
                </Text>
                <Text variant="micro" tone="secondary" numberOfLines={1}>
                  {m.roles.find((r) => COMMITTEE_ROLES.has(r.key))?.name ?? ''}
                </Text>
              </Glass>
            ))}
          </ScrollView>
        </Rise>
      ) : null}
      {list.isLoading ? (
        <View style={styles.loading}>
          <Skeleton className="h-[160px] rounded-[28px]" />
          <Skeleton className="h-[300px] rounded-[28px]" />
        </View>
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
        keyboardShouldPersistTaps="handled"
        errorClassName="mt-6"
        empty={
          <EmptyState
            icon="people"
            title={q ? t('society:directory.glow.noMatch', { q }) : t('society:directory.empty')}
            body={q ? undefined : t('society:directory.emptyBody')}
            className="mt-6"
          />
        }
      />
    </Screen>
  );
}

/** Committee face: 58 round, with the slow pulse ring of the mockup. */
function CommitteeFace({ member, delay }: { member: MemberCard; delay: number }) {
  const uri = photoUri(member.avatarUrl);
  if (uri) return <Face member={member} size={58} />;
  return (
    <GlowAvatar
      initials={initialsOf(member.displayName)}
      size={58}
      tone={toneFor(member.membershipId)}
      pulse
      delay={delay}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 130 },
  header: { gap: 14, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chipsScroll: { marginHorizontal: -theme.layout.gutter },
  chips: { gap: 8, paddingHorizontal: theme.layout.gutter },
  committee: { gap: 10, paddingHorizontal: theme.layout.gutter, paddingBottom: 4 },
  committeeCard: {
    width: 118,
    paddingTop: 16,
    paddingHorizontal: 10,
    paddingBottom: 14,
    alignItems: 'center',
    gap: 8,
  },
  loading: { gap: 14 },
  list: { padding: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 22 },
  bar: { color: 'rgba(106,105,112,0.4)' },
  call: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(70,40,70,0.06)',
  },
});
