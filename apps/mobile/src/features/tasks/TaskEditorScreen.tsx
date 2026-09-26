import {
  BottomBar,
  Button,
  DateTimeSheet,
  Input,
  OptionSheet,
  Screen,
  SelectField,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatFlat, useSocietyId } from '../../core/tenant/hooks';
import { day, isoDay } from '../../core/util/money';
import { localeTag } from '../../core/util/time';
import { useMembers } from '../directory/api';
import { useSaveTask, useTask } from './api';

const ANYONE = 'anyone';

export function TaskEditorScreen() {
  const { t } = useTranslation(['tasks', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const taskId = useRoute<RouteProp<RootStackParamList, 'TaskEditor'>>().params?.taskId;
  const existing = useTask(societyId, taskId ?? '');
  const save = useSaveTask(societyId, taskId);
  const members = useMembers(societyId, '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('0');
  const [due, setDue] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState<string>(ANYONE);
  const [sheet, setSheet] = useState<'date' | 'who' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const people = members.data?.pages.flatMap((p) => p.items) ?? [];

  useEffect(() => {
    const x = existing.data;
    if (!taskId || !x) return;
    setTitle(x.title);
    setDescription(x.description ?? '');
    setPoints(String(x.points));
    if (x.dueOn) {
      const [y, m, d] = x.dueOn.split('-').map(Number);
      setDue(new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1));
    }
  }, [taskId, existing.data]);

  const submit = async () => {
    setError(null);
    const p = Number.parseInt(points || '0', 10);
    if (title.trim().length < 2 || !(p >= 0 && p <= 100)) {
      setError(t('common:validation.required'));
      return;
    }
    try {
      const x = await save.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        points: p,
        dueOn: due ? isoDay(due) : null,
        assigneeMembershipId: assignee === ANYONE ? null : assignee,
      });
      toast.show(t('tasks:form.saved'));
      if (taskId) nav.goBack();
      else nav.replace('TaskDetail', { taskId: x.id });
    } catch (e) {
      setError(toMessage(e));
    }
  };

  return (
    <>
      <Screen bottomBar>
        <TitleBar
          title={taskId ? t('common:actions.edit') : t('tasks:new')}
          onBack={() => nav.goBack()}
        />
        <View className="mt-6 gap-3">
          <Input
            label={t('tasks:form.title')}
            placeholder={t('tasks:form.titleHint')}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          <Input
            label={t('tasks:form.description')}
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={2000}
            style={{ minHeight: 90, textAlignVertical: 'top' }}
          />
          <Input
            label={t('tasks:form.points')}
            value={points}
            onChangeText={setPoints}
            keyboardType="number-pad"
            maxLength={3}
          />
          <SelectField
            label={t('tasks:form.due')}
            value={due ? day(isoDay(due)) : t('tasks:form.noDue')}
            onPress={() => setSheet('date')}
          />
          {!taskId ? (
            <SelectField
              label={t('tasks:form.assignee')}
              value={
                assignee === ANYONE
                  ? t('tasks:form.anyone')
                  : people.find((m) => m.membershipId === assignee)?.displayName
              }
              onPress={() => setSheet('who')}
            />
          ) : null}
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
            label={taskId ? t('common:actions.save') : t('tasks:form.create')}
            inline
            loading={save.isPending}
            onPress={() => void submit()}
          />
        }
      />
      <DateTimeSheet
        visible={sheet === 'date'}
        onClose={() => setSheet(null)}
        mode="date"
        title={t('tasks:form.due')}
        value={due ?? new Date()}
        onChange={setDue}
        localeTag={localeTag()}
        labels={{
          date: t('common:picker.date'),
          time: t('common:picker.time'),
          minutes: t('common:picker.minutes'),
          done: t('common:actions.done'),
        }}
      />
      <OptionSheet
        visible={sheet === 'who'}
        onClose={() => setSheet(null)}
        title={t('tasks:form.assignee')}
        value={assignee}
        options={[
          { value: ANYONE, label: t('tasks:form.anyone') },
          ...people.map((m) => ({
            value: m.membershipId,
            label: m.displayName,
            hint: m.flats[0] ? formatFlat(m.flats[0]) : undefined,
          })),
        ]}
        onSelect={setAssignee}
      />
    </>
  );
}
