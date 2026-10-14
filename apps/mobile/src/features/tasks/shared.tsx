import type { TaskStatus, TaskSummary } from '@movo/contracts';
import { Pill, Row } from '@movo/design-system';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useNav } from '../../core/navigation/types';
import { StatusPill, type StatusTones } from '../../core/ui/StatusPill';
import { day } from '../../core/util/money';

const TONE: StatusTones<TaskStatus> = {
  OPEN: 'info',
  IN_PROGRESS: 'warning',
  SUBMITTED: 'ink',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return <StatusPill value={status} tones={TONE} labels="tasks:status" />;
}

export function TaskRow({ task }: { task: TaskSummary }) {
  const { t } = useTranslation('tasks');
  const nav = useNav();
  return (
    <Row
      icon="tasks"
      title={task.title}
      subtitle={[
        task.assignee?.displayName ?? t('openForAll'),
        task.dueOn ? t('due', { date: day(task.dueOn, 'short') }) : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      trailing={
        <View className="items-end gap-1">
          {task.points > 0 ? <Pill label={t('points', { count: task.points })} size="sm" /> : null}
          {task.status !== 'OPEN' ? <TaskStatusPill status={task.status} /> : null}
        </View>
      }
      onPress={() => nav.navigate('TaskDetail', { taskId: task.id })}
    />
  );
}
