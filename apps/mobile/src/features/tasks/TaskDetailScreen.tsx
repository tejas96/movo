import {
  BottomBar,
  Button,
  Card,
  Divider,
  IconSquare,
  Input,
  OptionSheet,
  Pill,
  Row,
  Screen,
  SectionHeader,
  Sheet,
  Skeleton,
  Text,
  TitleBar,
  useToast,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useErrorMessage } from '../../core/api/use-error-message';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { formatFlat, useSocietyId } from '../../core/tenant/hooks';
import { day } from '../../core/util/money';
import { relative } from '../../core/util/time';
import { useMembers } from '../directory/api';
import { type TaskAction, useTask, useTaskAction } from './api';
import { TaskStatusPill } from './shared';

type MenuKey = 'edit' | 'assign' | 'open' | 'cancel';

export function TaskDetailScreen() {
  const { t } = useTranslation(['tasks', 'common']);
  const nav = useNav();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const societyId = useSocietyId();
  const { taskId } = useRoute<RouteProp<RootStackParamList, 'TaskDetail'>>().params;
  const task = useTask(societyId, taskId);
  const action = useTaskAction(societyId, taskId);
  const members = useMembers(societyId, '');
  const [menu, setMenu] = useState(false);
  const [pick, setPick] = useState(false);
  const [sheet, setSheet] = useState<'submit' | 'sendBack' | 'cancel' | null>(null);
  const [text, setText] = useState('');
  const x = task.data;

  const run = async (a: TaskAction, ok: string) => {
    try {
      await action.mutateAsync(a);
      toast.show(ok);
      setSheet(null);
    } catch (e) {
      toast.show(toMessage(e), 'error');
    }
  };

  const menuOptions: { value: MenuKey; label: string }[] = x?.canManage
    ? [
        { value: 'edit', label: t('common:actions.edit') },
        { value: 'assign', label: t('tasks:actions.assign') },
        ...(x.assignee ? [{ value: 'open' as const, label: t('tasks:actions.openUp') }] : []),
        { value: 'cancel', label: t('tasks:actions.cancel') },
      ]
    : [];

  const primary = x
    ? x.canVolunteer
      ? {
          label: t('tasks:actions.volunteer'),
          onPress: () => void run({ kind: 'volunteer' }, t('tasks:actions.volunteered')),
        }
      : x.canSubmit
        ? {
            label: t('tasks:actions.submit'),
            onPress: () => {
              setText('');
              setSheet('submit');
            },
          }
        : x.canVerify
          ? {
              label: t('tasks:actions.verify'),
              onPress: () => void run({ kind: 'verify' }, t('tasks:actions.verified')),
            }
          : null
    : null;

  return (
    <>
      <Screen
        bottomBar={Boolean(primary)}
        refreshing={task.isRefetching}
        onRefresh={() => void task.refetch()}
      >
        <TitleBar
          title={t('tasks:title')}
          onBack={() => nav.goBack()}
          trailing={
            menuOptions.length > 0 ? (
              <IconSquare icon="more" variant="linear" onPress={() => setMenu(true)} />
            ) : undefined
          }
        />
        {task.isLoading || !x ? (
          <Skeleton className="mt-6 h-48 rounded-xl" />
        ) : (
          <>
            <Card className="mt-6">
              <View className="flex-row flex-wrap items-center gap-2">
                <TaskStatusPill status={x.status} />
                {x.points > 0 ? (
                  <Pill icon="star" label={t('tasks:points', { count: x.points })} size="sm" />
                ) : null}
                {x.dueOn ? (
                  <Pill
                    icon="calendar"
                    label={t('tasks:due', { date: day(x.dueOn, 'short') })}
                    size="sm"
                  />
                ) : null}
              </View>
              <Text variant="h2" className="mt-3">
                {x.title}
              </Text>
              {x.description ? (
                <Text variant="body" className="mt-2 leading-6">
                  {x.description}
                </Text>
              ) : null}
              <Divider />
              <Text variant="bodyMedium">{x.assignee?.displayName ?? t('tasks:openForAll')}</Text>
              {x.submissionNote ? (
                <Text variant="body" tone="secondary" className="mt-1">
                  {x.submissionNote}
                </Text>
              ) : null}
              <Text variant="label" tone="secondary" className="mt-3">
                {t('tasks:createdBy', { name: x.createdBy.displayName })}
              </Text>
            </Card>
            {x.canVerify ? (
              <Button
                className="mt-3"
                variant="gray"
                label={t('tasks:actions.sendBack')}
                onPress={() => {
                  setText('');
                  setSheet('sendBack');
                }}
              />
            ) : null}
            {x.canWithdraw ? (
              <Button
                className="mt-3"
                variant="ghost"
                label={t('tasks:actions.withdraw')}
                onPress={() => void run({ kind: 'withdraw' }, t('tasks:actions.withdrawn'))}
              />
            ) : null}
            <SectionHeader title={t('tasks:history')} />
            <Card tight className="gap-2">
              {x.events.map((e) => (
                <Row
                  key={`${e.kind}-${e.createdAt}`}
                  icon="clock"
                  title={t(`tasks:event.${e.kind}`)}
                  subtitle={[e.by.displayName, relative(e.createdAt), e.note]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ))}
            </Card>
          </>
        )}
      </Screen>
      {primary ? (
        <BottomBar
          action={
            <Button
              label={primary.label}
              inline
              loading={action.isPending}
              onPress={primary.onPress}
            />
          }
        />
      ) : null}
      <OptionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        options={menuOptions}
        onSelect={(k) => {
          if (k === 'edit') nav.navigate('TaskEditor', { taskId });
          else if (k === 'assign') setPick(true);
          else if (k === 'open')
            void run({ kind: 'assign', membershipId: null }, t('tasks:actions.assigned'));
          else setSheet('cancel');
        }}
      />
      <OptionSheet
        visible={pick}
        onClose={() => setPick(false)}
        title={t('tasks:form.assignee')}
        value={x?.assignee?.membershipId}
        options={(members.data?.pages.flatMap((p) => p.items) ?? []).map((m) => ({
          value: m.membershipId,
          label: m.displayName,
          hint: m.flats[0] ? formatFlat(m.flats[0]) : undefined,
        }))}
        onSelect={(id) =>
          void run({ kind: 'assign', membershipId: id }, t('tasks:actions.assigned'))
        }
      />
      <Sheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        title={
          sheet === 'submit'
            ? t('tasks:actions.submitTitle')
            : sheet === 'sendBack'
              ? t('tasks:actions.sendBackTitle')
              : t('tasks:actions.cancel')
        }
        footer={
          <Button
            label={
              sheet === 'submit'
                ? t('tasks:actions.submit')
                : sheet === 'sendBack'
                  ? t('tasks:actions.sendBack')
                  : t('tasks:actions.cancel')
            }
            variant={sheet === 'cancel' ? 'danger' : 'ink'}
            loading={action.isPending}
            disabled={sheet === 'sendBack' && text.trim().length < 2}
            onPress={() =>
              sheet === 'submit'
                ? void run(
                    { kind: 'submit', note: text.trim() || undefined },
                    t('tasks:actions.submitted'),
                  )
                : sheet === 'sendBack'
                  ? void run({ kind: 'sendBack', reason: text.trim() }, t('tasks:actions.sentBack'))
                  : void run({ kind: 'cancel' }, t('tasks:actions.cancelled'))
            }
          />
        }
      >
        {sheet === 'cancel' ? (
          <Text variant="body" tone="secondary">
            {x?.title ?? ''}
          </Text>
        ) : (
          <Input
            white
            multiline
            label={sheet === 'submit' ? t('tasks:actions.note') : t('tasks:actions.reason')}
            value={text}
            onChangeText={setText}
            maxLength={1000}
            style={{ minHeight: 90, textAlignVertical: 'top' }}
          />
        )}
      </Sheet>
    </>
  );
}
