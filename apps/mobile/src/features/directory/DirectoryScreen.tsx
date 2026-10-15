import type { MemberCard } from '@movo/contracts';
import {
  Chip,
  CircleButton,
  EmptyState,
  PersonCard,
  photos,
  Screen,
  SearchBar,
  Skeleton,
  StatusPill,
  TitleBar,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, View } from 'react-native';
import { photoUri } from '../../core/api/client';
import { useMembers } from '../../core/members/api';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useBuildings } from '../../core/society/api';
import { formatFlat, useSocietyId } from '../../core/tenant/hooks';
import { PagedList } from '../../core/ui/PagedList';

export function DirectoryScreen() {
  const { t } = useTranslation(['society', 'common', 'manage']);
  const nav = useNav();
  const societyId = useSocietyId();
  const manage = Boolean(useRoute<RouteProp<RootStackParamList, 'Directory'>>().params?.manage);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(id);
  }, [text]);
  const [buildingId, setBuildingId] = useState<string | undefined>(undefined);
  const buildings = useBuildings(societyId);
  const wings = buildings.data ?? [];
  const list = useMembers(societyId, q, buildingId);

  const role = (m: MemberCard) =>
    [
      m.flats.map(formatFlat).join(', ') || (m.isStaff ? t('society:directory.staff') : null),
      m.roles
        .filter((r) => r.key !== 'resident')
        .map((r) => r.name)
        .join(', '),
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <Screen scroll={false}>
      <TitleBar
        title={manage ? t('manage:members') : t('society:directory.title')}
        onBack={() => nav.goBack()}
      />
      <SearchBar
        className="mt-4"
        placeholder={t('society:directory.search')}
        value={text}
        onChangeText={setText}
        autoFocus={!manage}
      />
      {wings.length > 1 ? (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3 -mx-5"
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
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
        </View>
      ) : null}
      <PagedList
        list={list}
        loading={
          <View className="mt-4 gap-3">
            <Skeleton className="h-[68px] rounded-lg" />
            <Skeleton className="h-[68px] rounded-lg" />
            <Skeleton className="h-[68px] rounded-lg" />
          </View>
        }
        errorClassName="mt-10"
        empty={
          <EmptyState
            photo={photos.empty}
            icon="people"
            title={t('society:directory.empty')}
            body={t('society:directory.emptyBody')}
            className="mt-10"
          />
        }
        className="mt-4"
        keyExtractor={(m) => m.membershipId}
        contentContainerStyle={{ paddingBottom: 40, gap: 12 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <PersonCard
            name={item.displayName}
            avatarUri={photoUri(item.avatarUrl)}
            verified={item.roles.some((r) => r.key === 'admin')}
            role={role(item)}
            onPress={() => nav.navigate('MemberDetail', { membershipId: item.membershipId })}
            actions={
              manage && item.status !== 'ACTIVE' ? (
                <StatusPill label={t(`common:status.${item.status}`)} tone="neutral" />
              ) : item.phone ? (
                <CircleButton
                  icon="call"
                  onPress={() => void Linking.openURL(`tel:${item.phone}`)}
                />
              ) : undefined
            }
          />
        )}
      />
    </Screen>
  );
}
