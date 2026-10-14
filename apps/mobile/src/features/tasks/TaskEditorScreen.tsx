import {
  BottomBar,
  Button,
  DateTimeSheet,
  Input,
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
import { useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { day, isoDay } from '../../core/util/money';
import { localeTag } from '../../core/util/time';
import { MemberPickerSheet } from '../directory/MemberPickerSheet';
import { useSaveTask, useTask } from './api';

export function TaskEditorScreen() {
  const { t } = useTranslation(['tasks', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const taskId = useRoute<RouteProp<RootStackParamList, 'TaskEditor'>>().params?.taskId;
  const existing = useTask(societyId, taskId ?? '');
  const save = useSaveTask(societyId, taskId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('0');
  const [due, setDue] = useState<Date | null>(null);
  const [assignee, setAssignee] = useState<{ id: string; name: string } | null>(null);
  const [sheet, setSheet] = useState<'date' | 'who' | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        assigneeMembershipId: assignee?.id ?? null,
      });
      toast.show(t('tasks:form.saved'));
      if (taskId) nav.goBack();
      else nav.replace('TaskDetail', { taskId: x.id });
    } catch (e) {
      setError(toMessage(e));
    }
  };

  if (taskId && loadFailed(existing))
    return (
      <Screen>
        <TitleBar title={t('common:actions.edit')} onBack={() => nav.goBack()} />
        <QueryError query={existing} className="mt-10" />
      </Screen>
    );

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
              value={assignee?.name ?? t('tasks:form.anyone')}
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
      <MemberPickerSheet
        visible={sheet === 'who'}
        onClose={() => setSheet(null)}
        societyId={societyId}
        title={t('tasks:form.assignee')}
        value={assignee?.id}
        none={{ label: t('tasks:form.anyone'), onSelect: () => setAssignee(null) }}
        onSelect={(m) => setAssignee({ id: m.membershipId, name: m.displayName })}
      />
    </>
  );
}
