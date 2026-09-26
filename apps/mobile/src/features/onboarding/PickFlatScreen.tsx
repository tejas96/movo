import { type OccupancyRelation, OccupancyRelationSchema } from '@movo/contracts';
import {
  BottomBar,
  Button,
  Chip,
  EmptyState,
  Input,
  OptionSheet,
  Screen,
  SelectField,
  Skeleton,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useJoinPreview, useJoinRequest } from './api';

/** Pick wing and flat, say who you are, send the request. */
export function PickFlatScreen() {
  const { t } = useTranslation(['onboarding', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const { joinCode } = useRoute<RouteProp<RootStackParamList, 'PickFlat'>>().params;
  const preview = useJoinPreview(joinCode, true);
  const request = useJoinRequest();
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [flatId, setFlatId] = useState<string | null>(null);
  const [relation, setRelation] = useState<OccupancyRelation>('OWNER');
  const [message, setMessage] = useState('');
  const [relationOpen, setRelationOpen] = useState(false);

  const flats = useMemo(() => {
    const all = preview.data?.flats ?? [];
    return buildingId ? all.filter((f) => f.buildingId === buildingId) : all;
  }, [preview.data, buildingId]);
  const relationOptions = OccupancyRelationSchema.options.map((r) => ({
    value: r,
    label: t(`common:relation.${r}`),
  }));

  const submit = async () => {
    if (!flatId) return;
    try {
      await request.mutateAsync({
        joinCode,
        flatId,
        relation,
        message: message.trim() || undefined,
      });
      nav.navigate('Pending');
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={preview.data?.society.name ?? t('onboarding:findSociety')}
          onBack={() => nav.goBack()}
        />
        <Text variant="h2" className="mt-6">
          {t('onboarding:pickFlat')}
        </Text>
        {preview.isLoading ? (
          <View className="mt-4 gap-3">
            <Skeleton className="h-12 w-2/3 rounded-full" />
            <Skeleton className="h-40" />
          </View>
        ) : preview.data && preview.data.flats.length === 0 ? (
          <EmptyState icon="building" title={t('onboarding:noFlatsYet')} className="mt-6" />
        ) : preview.data ? (
          <>
            {preview.data.buildings.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mt-3 -mx-5"
                contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
              >
                <Chip
                  label={t('common:actions.seeAll')}
                  selected={buildingId === null}
                  onPress={() => setBuildingId(null)}
                  className="h-11"
                />
                {preview.data.buildings.map((b) => (
                  <Chip
                    key={b.id}
                    label={b.name}
                    selected={buildingId === b.id}
                    onPress={() => setBuildingId(b.id)}
                    className="h-11"
                  />
                ))}
              </ScrollView>
            ) : null}
            <View className="mt-4 flex-row flex-wrap gap-2">
              {flats.map((f) => {
                const on = f.id === flatId;
                const building = preview.data?.buildings.find((b) => b.id === f.buildingId);
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setFlatId(f.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    className={
                      on
                        ? 'h-12 min-w-[84px] items-center justify-center rounded-md bg-ink px-4'
                        : 'h-12 min-w-[84px] items-center justify-center rounded-md bg-card px-4 active:bg-card-deep'
                    }
                  >
                    <Text variant="bodyMedium" tone={on ? 'inverse' : 'primary'}>
                      {building && !buildingId ? `${building.name}-${f.number}` : f.number}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View className="mt-6 gap-3">
              <SelectField
                label={t('onboarding:relation')}
                value={t(`common:relation.${relation}`)}
                onPress={() => setRelationOpen(true)}
              />
              <Input
                label={t('onboarding:message')}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={300}
              />
            </View>
          </>
        ) : null}
      </Screen>
      <BottomBar
        label={preview.data?.society.name}
        value={flatId ? (flats.find((f) => f.id === flatId)?.number ?? '') : '—'}
        action={
          <Button
            label={t('onboarding:sendRequest')}
            inline
            onPress={() => void submit()}
            disabled={!flatId}
            loading={request.isPending}
          />
        }
      />
      <OptionSheet
        visible={relationOpen}
        onClose={() => setRelationOpen(false)}
        title={t('onboarding:relation')}
        options={relationOptions}
        value={relation}
        onSelect={setRelation}
      />
    </>
  );
}
