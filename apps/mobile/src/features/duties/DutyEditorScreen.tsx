import {
  type DutyParticipantKind,
  type DutyPeriodUnit,
  dutiesContract,
  type MemberCard,
} from '@movo/contracts';
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
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { bodyResolver, formMessage } from '../../core/forms/contract-form';
import { useNav } from '../../core/navigation/types';
import { formatFlat, useSocietyId, useTenant } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { day, isoDay, localeTag } from '../../core/util/date';
import { MemberPickerSheet } from '../directory/MemberPickerSheet';
import { useFlats } from '../manage/api';
import { useCreateDuty } from './api';
import { OrderedPickSheet } from './shared';

const firstOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

interface DutyForm {
  title: string;
  description: string;
  kind: DutyParticipantKind;
  ids: string[];
  unit: DutyPeriodUnit;
  start: Date;
  confirm: boolean;
  carry: boolean;
  points: string;
}

const EMPTY: Omit<DutyForm, 'start' | 'confirm'> = {
  title: '',
  description: '',
  kind: 'FLAT',
  ids: [],
  unit: 'MONTH',
  carry: false,
  points: '',
};

function toBody(v: DutyForm) {
  return {
    title: v.title.trim(),
    description: v.description.trim() || null,
    participantKind: v.kind,
    participantIds: v.ids,
    periodUnit: v.unit,
    periodLength: 1,
    startDate: isoDay(v.start),
    requiresConfirmation: v.confirm,
    onMiss: v.carry ? ('CARRY_OVER' as const) : ('MARK_MISSED' as const),
    points: v.points.trim() ? Number.parseInt(v.points, 10) : null,
  };
}

export function DutyEditorScreen() {
  const { t } = useTranslation(['duties', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const tenant = useTenant();
  const create = useCreateDuty(societyId);
  const flats = useFlats(societyId);
  const defaultConfirm =
    (tenant.modules.find((m) => m.key === 'responsibilities')?.settings
      .defaultRequiresConfirmation as boolean | undefined) ?? true;
  const form = useForm<DutyForm>({
    resolver: bodyResolver(dutiesContract.create.body, toBody),
    defaultValues: { ...EMPTY, start: firstOfMonth(), confirm: defaultConfirm },
    reValidateMode: 'onSubmit',
  });
  const error = formMessage(form, t('common:validation.required'));
  const { kind, ids, unit, start, confirm, carry } = form.watch();
  // Members come from a server search, so remember the names of the ones picked.
  const [names, setNames] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<'people' | 'date' | null>(null);

  const flatItems = (flats.data ?? []).map((f) => ({ id: f.id, label: formatFlat(f) }));
  const labels = ids
    .map((id) =>
      kind === 'FLAT' ? (flatItems.find((f) => f.id === id)?.label ?? '') : (names[id] ?? ''),
    )
    .filter(Boolean);
  const toggleMember = (m: MemberCard) => {
    setNames((old) => ({ ...old, [m.membershipId]: m.displayName }));
    const old = form.getValues('ids');
    form.setValue(
      'ids',
      old.includes(m.membershipId)
        ? old.filter((id) => id !== m.membershipId)
        : [...old, m.membershipId],
    );
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      const d = await create.mutateAsync(toBody(values));
      toast.show(t('duties:form.saved'));
      nav.replace('DutyDetail', { dutyId: d.id });
    } catch (e) {
      form.setError('root.server', { message: toMessage(e) });
    }
  });

  if (loadFailed(flats))
    return (
      <Screen>
        <TitleBar title={t('duties:new')} onBack={() => nav.goBack()} />
        <QueryError query={flats} className="mt-10" />
      </Screen>
    );

  return (
    <>
      <Screen bottomBar>
        <TitleBar title={t('duties:new')} onBack={() => nav.goBack()} />
        <View className="mt-6 gap-3">
          <Controller
            control={form.control}
            name="title"
            render={({ field }) => (
              <Input
                label={t('duties:form.title')}
                placeholder={t('duties:form.titleHint')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={80}
              />
            )}
          />
          <Controller
            control={form.control}
            name="description"
            render={({ field }) => (
              <Input
                label={t('duties:form.description')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={1000}
              />
            )}
          />
          <View>
            <Text variant="label" tone="secondary" className="mb-1.5">
              {t('duties:form.kind')}
            </Text>
            <Segmented
              value={kind}
              onChange={(k) => {
                form.setValue('kind', k);
                form.setValue('ids', []);
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
              onChange={(u) => form.setValue('unit', u)}
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
            <Toggle value={confirm} onValueChange={(v) => form.setValue('confirm', v)} />
          </View>
          {confirm ? (
            <View>
              <Text variant="label" tone="secondary" className="mb-1.5">
                {t('duties:form.onMiss')}
              </Text>
              <Segmented
                value={carry ? 'CARRY_OVER' : 'MARK_MISSED'}
                onChange={(v) => form.setValue('carry', v === 'CARRY_OVER')}
                options={[
                  { value: 'MARK_MISSED', label: t('duties:form.onMissOpt.MARK_MISSED') },
                  { value: 'CARRY_OVER', label: t('duties:form.onMissOpt.CARRY_OVER') },
                ]}
              />
            </View>
          ) : null}
          <Controller
            control={form.control}
            name="points"
            render={({ field }) => (
              <Input
                label={t('duties:form.points')}
                value={field.value}
                onChangeText={field.onChange}
                keyboardType="number-pad"
                maxLength={3}
              />
            )}
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
        visible={sheet === 'people' && kind === 'FLAT'}
        onClose={() => setSheet(null)}
        title={t('duties:form.pickFlats')}
        items={flatItems}
        value={ids}
        onChange={(next) => form.setValue('ids', next)}
      />
      <MemberPickerSheet
        multiple
        visible={sheet === 'people' && kind === 'MEMBER'}
        onClose={() => setSheet(null)}
        societyId={societyId}
        title={t('duties:form.pickMembers')}
        value={ids}
        onToggle={toggleMember}
      />
      <DateTimeSheet
        visible={sheet === 'date'}
        onClose={() => setSheet(null)}
        mode="date"
        pastDays={60}
        days={120}
        title={t('duties:form.start')}
        value={start}
        onChange={(d) => form.setValue('start', d)}
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
