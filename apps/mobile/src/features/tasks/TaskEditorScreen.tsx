import { type Task, tasksContract } from '@movo/contracts';
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
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { bodyResolver, formMessage, usePrefill } from '../../core/forms/contract-form';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useSocietyId } from '../../core/tenant/hooks';
import { loadFailed, QueryError } from '../../core/ui/QueryError';
import { day, fromIsoDay, isoDay } from '../../core/util/money';
import { localeTag } from '../../core/util/time';
import { MemberPickerSheet } from '../directory/MemberPickerSheet';
import { useSaveTask, useTask } from './api';

interface TaskForm {
  title: string;
  description: string;
  points: string;
  due: Date | null;
  assignee: { id: string; name: string } | null;
}

const EMPTY: TaskForm = { title: '', description: '', points: '0', due: null, assignee: null };

function toForm(x: Task): TaskForm {
  return {
    title: x.title,
    description: x.description ?? '',
    points: String(x.points),
    due: x.dueOn ? fromIsoDay(x.dueOn) : null,
    assignee: null,
  };
}

function toBody(v: TaskForm) {
  return {
    title: v.title.trim(),
    description: v.description.trim() || null,
    points: Number.parseInt(v.points || '0', 10),
    dueOn: v.due ? isoDay(v.due) : null,
    assigneeMembershipId: v.assignee?.id ?? null,
  };
}

export function TaskEditorScreen() {
  const { t } = useTranslation(['tasks', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const taskId = useRoute<RouteProp<RootStackParamList, 'TaskEditor'>>().params?.taskId;
  const existing = useTask(societyId, taskId ?? '');
  const save = useSaveTask(societyId, taskId);
  const [sheet, setSheet] = useState<'date' | 'who' | null>(null);
  const form = useForm<TaskForm>({
    resolver: bodyResolver(tasksContract.create.body, toBody),
    defaultValues: EMPTY,
    reValidateMode: 'onSubmit',
  });
  usePrefill(form, taskId ? existing.data : undefined, toForm);
  const error = formMessage(form, t('common:validation.required'));
  const { due, assignee } = form.watch();

  const submit = form.handleSubmit(async (values) => {
    try {
      const x = await save.mutateAsync(toBody(values));
      toast.show(t('tasks:form.saved'));
      if (taskId) nav.goBack();
      else nav.replace('TaskDetail', { taskId: x.id });
    } catch (e) {
      form.setError('root.server', { message: toMessage(e) });
    }
  });

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
          <Controller
            control={form.control}
            name="title"
            render={({ field }) => (
              <Input
                label={t('tasks:form.title')}
                placeholder={t('tasks:form.titleHint')}
                value={field.value}
                onChangeText={field.onChange}
                maxLength={100}
              />
            )}
          />
          <Controller
            control={form.control}
            name="description"
            render={({ field }) => (
              <Input
                label={t('tasks:form.description')}
                value={field.value}
                onChangeText={field.onChange}
                multiline
                maxLength={2000}
                style={{ minHeight: 90, textAlignVertical: 'top' }}
              />
            )}
          />
          <Controller
            control={form.control}
            name="points"
            render={({ field }) => (
              <Input
                label={t('tasks:form.points')}
                value={field.value}
                onChangeText={field.onChange}
                keyboardType="number-pad"
                maxLength={3}
              />
            )}
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
        onChange={(d) => form.setValue('due', d)}
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
        none={{ label: t('tasks:form.anyone'), onSelect: () => form.setValue('assignee', null) }}
        onSelect={(m) => form.setValue('assignee', { id: m.membershipId, name: m.displayName })}
      />
    </>
  );
}
