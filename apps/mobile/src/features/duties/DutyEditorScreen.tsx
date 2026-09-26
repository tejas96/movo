import type { DutyParticipantKind, DutyPeriodUnit } from '@movo/contracts';
import {
  BottomBar,
  Button,
  DateTimeSheet,
  Input,
  Screen,
  Segmented,
  SelectField,
  Text,
  TitleBar,
  Toggle,
  useToast,
} from '@movo/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { day, isoDay } from '../../core/util/money';
import { localeTag } from '../../core/util/time';
import { useMembers } from '../directory/api';
import { useFlats } from '../manage/api';
import { useCreateDuty } from './api';
import { OrderedPickSheet } from './shared';

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

export function DutyEditorScreen() {
  const { t } = useTranslation(['duties', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const create = useCreateDuty(societyId);
  const flats = useFlats(societyId);
  const members = useMembers(societyId, '');
  const defaultConfirm =
    (tenant.modules.find((m) => m.key === 'responsibilities')?.settings
      .defaultRequiresConfirmation as boolean | undefined) ?? true;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<DutyParticipantKind>('FLAT');
  const [ids, setIds] = useState<string[]>([]);
  const [unit, setUnit] = useState<DutyPeriodUnit>('MONTH');
  const [start, setStart] = useState(firstOfMonth);
  const [confirm, setConfirm] = useState(defaultConfirm);
  const [carry, setCarry] = useState(false);
  const [points, setPoints] = useState('');
  const [sheet, setSheet] = useState<'people' | 'date' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const candidates =
    kind === 'FLAT'
      ? (flats.data ?? []).map((f) => ({ id: f.id, label: formatFlat(f) }))
      : (members.data?.pages.flatMap((p) => p.items) ?? []).map((m) => ({
          id: m.membershipId,
          label: m.displayName,
          hint: m.flats[0] ? formatFlat(m.flats[0]) : undefined,
        }));
  const labels = ids.map((id) => candidates.find((c) => c.id === id)?.label ?? '').filter(Boolean);

  const submit = async () => {
    setError(null);
    const p = points.trim() ? Number.parseInt(points, 10) : null;
    if (title.trim().length < 2 || ids.length === 0 || (p !== null && !(p >= 1 && p <= 100))) {
      setError(t('common:validation.required'));
      return;
    }
    try {
      const d = await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        participantKind: kind,
        participantIds: ids,
        periodUnit: unit,
        periodLength: 1,
        startDate: isoDay(start),
        requiresConfirmation: confirm,
        onMiss: carry ? 'CARRY_OVER' : 'MARK_MISSED',
        points: p,
      });
      toast.show(t('duties:form.saved'));
      nav.replace('DutyDetail', { dutyId: d.id });
    } catch (e) {
      setError(toMessage(e));
    }
  };

  return (
    <>
      <Screen bottomBar>
        <TitleBar title={t('duties:new')} onBack={() => nav.goBack()} />
        <View className="mt-6 gap-3">
          <Input
            label={t('duties:form.title')}
            placeholder={t('duties:form.titleHint')}
            value={title}
            onChangeText={setTitle}
            maxLength={80}
          />
          <Input
            label={t('duties:form.description')}
            value={description}
            onChangeText={setDescription}
            maxLength={1000}
          />
          <View>
            <Text variant="label" tone="secondary" className="mb-1.5">
              {t('duties:form.kind')}
            </Text>
            <Segmented
              value={kind}
              onChange={(k) => {
                setKind(k);
                setIds([]);
              }}
              options={[
                { value: 'FLAT', label: t('duties:form.kindOpt.FLAT') },
                { value: 'MEMBER', label: t('duties:form.kindOpt.MEMBER') },
              ]}
            />
          </View>
          <SelectField
            label={t('duties:form.participants')}
            value={labels.length ? labels.join(' → ') : undefined}
            placeholder={
              kind === 'FLAT' ? t('duties:form.pickFlats') : t('duties:form.pickMembers')
            }
            onPress={() => setSheet('people')}
          />
          <View>
            <Text variant="label" tone="secondary" className="mb-1.5">
              {t('duties:form.unit')}
            </Text>
            <Segmented
              value={unit}
              onChange={setUnit}
              options={(['DAY', 'WEEK', 'MONTH'] as const).map((u) => ({
                value: u,
                label: t(`duties:form.unitOpt.${u}`),
              }))}
            />
          </View>
          <SelectField
            label={t('duties:form.start')}
            value={day(isoDay(start))}
            onPress={() => setSheet('date')}
          />
          <View className="flex-row items-center justify-between rounded-md bg-card px-[18px] py-3">
            <Text variant="body" className="flex-1">
              {t('duties:form.confirm')}
            </Text>
            <Toggle value={confirm} onValueChange={setConfirm} />
          </View>
          {confirm ? (
            <View>
              <Text variant="label" tone="secondary" className="mb-1.5">
                {t('duties:form.onMiss')}
              </Text>
              <Segmented
                value={carry ? 'CARRY_OVER' : 'MARK_MISSED'}
                onChange={(v) => setCarry(v === 'CARRY_OVER')}
                options={[
                  { value: 'MARK_MISSED', label: t('duties:form.onMissOpt.MARK_MISSED') },
                  { value: 'CARRY_OVER', label: t('duties:form.onMissOpt.CARRY_OVER') },
                ]}
              />
            </View>
          ) : null}
          <Input
            label={t('duties:form.points')}
            value={points}
            onChangeText={setPoints}
            keyboardType="number-pad"
            maxLength={3}
          />
          {error ? (
            <Text variant="caption" tone="danger">
              {error}
            </Text>
          ) : null}
        </View>
      </Screen>
      <BottomBar
        action={
          <Button
            label={t('duties:form.create')}
            inline
            loading={create.isPending}
            onPress={() => void submit()}
          />
        }
      />
      <OrderedPickSheet
        visible={sheet === 'people'}
        onClose={() => setSheet(null)}
        title={kind === 'FLAT' ? t('duties:form.pickFlats') : t('duties:form.pickMembers')}
        items={candidates}
        value={ids}
        onChange={setIds}
      />
      <DateTimeSheet
        visible={sheet === 'date'}
        onClose={() => setSheet(null)}
        mode="date"
        pastDays={60}
        days={120}
        title={t('duties:form.start')}
        value={start}
        onChange={setStart}
        localeTag={localeTag()}
        labels={{
          date: t('common:picker.date'),
          time: t('common:picker.time'),
          minutes: t('common:picker.minutes'),
          done: t('common:actions.done'),
        }}
      />
    </>
  );
}
