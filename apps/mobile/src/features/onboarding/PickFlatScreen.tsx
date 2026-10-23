import { type OccupancyRelation, OccupancyRelationSchema } from '@movo/contracts';
import {
  ArtCard,
  BottomBar,
  Building,
  Button,
  Chip,
  EmptyState,
  Glass,
  IconSquare,
  Input,
  Press,
  Rise,
  Screen,
  SectionLabel,
  Skeleton,
  Strong,
  Text,
  theme,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useMutationToast } from '../../core/api/use-mutation-toast';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { useJoinPreview, useJoinRequest } from './api';

/** Pick wing and flat, say who you are, send the request. */
export function PickFlatScreen() {
  const { t } = useTranslation(['onboarding', 'common']);
  const nav = useNav();
  const withErrorToast = useMutationToast();
  const { joinCode } = useRoute<RouteProp<RootStackParamList, 'PickFlat'>>().params;
  const preview = useJoinPreview(joinCode, true);
  const request = useJoinRequest();
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [flatId, setFlatId] = useState<string | null>(null);
  const [relation, setRelation] = useState<OccupancyRelation>('OWNER');
  const [message, setMessage] = useState('');

  const flats = useMemo(() => {
    const all = preview.data?.flats ?? [];
    return buildingId ? all.filter((f) => f.buildingId === buildingId) : all;
  }, [preview.data, buildingId]);

  const submit = async () => {
    if (!flatId) return;
    await withErrorToast(async () => {
      await request.mutateAsync({
        joinCode,
        flatId,
        relation,
        message: message.trim() || undefined,
      });
      nav.navigate('Pending');
    });
  };

  return (
    <>
      <Screen bottomBar>
        <View style={styles.page}>
          <Rise>
            <View style={styles.titleRow}>
              <IconSquare
                icon="back"
                variant="linear"
                diameter={46}
                onPress={() => nav.goBack()}
                accessibilityLabel={t('common:actions.back')}
              />
              <Text variant="greet" className="flex-1" numberOfLines={2}>
                {t('onboarding:glow.pickA')} <Strong>{t('onboarding:glow.pickB')}</Strong>
              </Text>
            </View>
          </Rise>

          <Rise delay={60}>
            <ArtCard art="home" height={170} contentStyle={styles.hero}>
              <View style={styles.heroText}>
                <Text variant="h2" numberOfLines={2}>
                  {preview.data?.society.name ?? t('onboarding:findSociety')}
                </Text>
                {preview.data?.society.city ? (
                  <Text variant="caption" tone="soft" numberOfLines={1}>
                    {preview.data.society.city}
                  </Text>
                ) : null}
              </View>
              <View style={styles.heroArt} pointerEvents="none">
                <Building width={104} />
              </View>
            </ArtCard>
          </Rise>

          {preview.isLoading ? (
            <View className="gap-3">
              <Skeleton className="h-11 w-2/3 rounded-full" />
              <Skeleton className="h-40 rounded-[30px]" />
            </View>
          ) : loadFailed(preview) ? (
            <QueryError query={preview} />
          ) : preview.data && preview.data.flats.length === 0 ? (
            <EmptyState icon="building" title={t('onboarding:noFlatsYet')} />
          ) : preview.data ? (
            <>
              {preview.data.buildings.length > 0 ? (
                <Rise delay={100}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipsScroll}
                    contentContainerStyle={styles.chips}
                  >
                    <Chip
                      label={t('common:actions.seeAll')}
                      selected={buildingId === null}
                      onPress={() => setBuildingId(null)}
                    />
                    {preview.data.buildings.map((b) => (
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

              <Rise delay={140}>
                <Glass radius={30} style={styles.card}>
                  <SectionLabel className="px-1 pt-0">{t('onboarding:flat')}</SectionLabel>
                  <View style={styles.flats} accessibilityRole="radiogroup">
                    {flats.map((f) => {
                      const on = f.id === flatId;
                      const building = preview.data?.buildings.find((b) => b.id === f.buildingId);
                      return (
                        <Press
                          key={f.id}
                          onPress={() => setFlatId(f.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: on }}
                          scaleTo={0.94}
                          style={[styles.flat, on && styles.flatOn]}
                        >
                          <Text variant="bodyMedium" tone={on ? 'inverse' : 'primary'}>
                            {building && !buildingId ? `${building.name}-${f.number}` : f.number}
                          </Text>
                        </Press>
                      );
                    })}
                  </View>
                </Glass>
              </Rise>

              <Rise delay={180}>
                <Glass radius={30} style={styles.card}>
                  <SectionLabel className="px-1 pt-0">{t('onboarding:glow.you')}</SectionLabel>
                  <View style={styles.relations} accessibilityRole="radiogroup">
                    {OccupancyRelationSchema.options.map((r) => (
                      <Chip
                        key={r}
                        label={t(`common:relation.${r}`)}
                        selected={relation === r}
                        onPress={() => setRelation(r)}
                        accessibilityRole="radio"
                      />
                    ))}
                  </View>
                  <Input
                    containerClassName="mt-4"
                    label={t('onboarding:message')}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    maxLength={300}
                  />
                </Glass>
              </Rise>
            </>
          ) : null}
        </View>
      </Screen>
      <BottomBar
        label={preview.data?.society.name}
        value={flatId ? (flats.find((f) => f.id === flatId)?.number ?? '') : '—'}
        action={
          <Button
            label={t('onboarding:sendRequest')}
            inline
            arrow
            onPress={() => void submit()}
            disabled={!flatId}
            loading={request.isPending}
          />
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  page: { gap: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hero: { flexDirection: 'row', alignItems: 'flex-end' },
  heroText: { flex: 1, gap: 2, paddingBottom: 2 },
  heroArt: { marginRight: -6, marginBottom: -10 },
  chipsScroll: { marginHorizontal: -theme.layout.gutter },
  chips: { gap: 8, paddingHorizontal: theme.layout.gutter },
  card: { padding: 14 },
  flats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  flat: {
    minWidth: 76,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
  },
  flatOn: { backgroundColor: theme.color.bg.ink, borderColor: theme.color.bg.ink },
  relations: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
});
