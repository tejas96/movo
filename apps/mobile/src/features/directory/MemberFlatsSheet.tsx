import { type MemberFlat, type OccupancyRelation, OccupancyRelationSchema } from '@movo/contracts';
import { Button, Chip, Sheet, Text, useToast } from '@movo/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { formatFlat, useSocietyId } from '../../core/tenant/hooks';
import { useFlats } from '../manage/api';
import { useSetOccupancies } from './api';

/** Committee picks the flats a member lives in or owns, and the relation to each. */
export function MemberFlatsSheet({
  visible,
  onClose,
  membershipId,
  current,
}: {
  visible: boolean;
  onClose: () => void;
  membershipId: string;
  current: MemberFlat[];
}) {
  const { t } = useTranslation(['manage', 'common']);
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const flats = useFlats(societyId);
  const save = useSetOccupancies(societyId, membershipId);
  const [picked, setPicked] = useState<Map<string, OccupancyRelation>>(new Map());

  useEffect(() => {
    if (visible) setPicked(new Map(current.map((f) => [f.id, f.relation])));
  }, [visible, current]);

  const flip = (id: string) =>
    setPicked((old) => {
      const next = new Map(old);
      if (next.has(id)) next.delete(id);
      else if (next.size < 10) next.set(id, 'OWNER');
      return next;
    });
  const setRelation = (id: string, relation: OccupancyRelation) =>
    setPicked((old) => new Map(old).set(id, relation));

  const submit = async () => {
    try {
      await save.mutateAsync({
        flats: [...picked].map(([flatId, relation], i) => ({
          flatId,
          relation,
          isPrimaryContact: current.find((f) => f.id === flatId)?.isPrimaryContact ?? i === 0,
        })),
      });
      toast.show(t('manage:member.updated'));
      onClose();
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  const all = flats.data ?? [];
  const chosen = all.filter((f) => picked.has(f.id));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('manage:member.editFlats')}
      footer={
        <Button
          label={t('common:actions.save')}
          loading={save.isPending}
          onPress={() => void submit()}
        />
      }
    >
      <Text variant="label" tone="secondary" className="mb-3">
        {t('manage:member.flatsHelp')}
      </Text>
      <ScrollView style={{ maxHeight: 180 }}>
        <View className="flex-row flex-wrap gap-2">
          {all.map((f) => (
            <Chip
              key={f.id}
              label={formatFlat({ number: f.number, buildingName: f.buildingName })}
              selected={picked.has(f.id)}
              onPress={() => flip(f.id)}
            />
          ))}
        </View>
      </ScrollView>
      {chosen.map((f) => (
        <View key={f.id} className="mt-4">
          <Text variant="label" tone="secondary" className="mb-1.5">
            {`${formatFlat({ number: f.number, buildingName: f.buildingName })} · ${t('manage:member.relation')}`}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {OccupancyRelationSchema.options.map((r) => (
              <Chip
                key={r}
                label={t(`common:relation.${r}`)}
                selected={picked.get(f.id) === r}
                onPress={() => setRelation(f.id, r)}
              />
            ))}
          </View>
        </View>
      ))}
    </Sheet>
  );
}
