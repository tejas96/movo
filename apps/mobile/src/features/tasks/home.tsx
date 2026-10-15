import { photos, StatusPill } from '@movo/design-system';
import type { FeatureHome } from '../../core/home/types';
import { day } from '../../core/util/date';

export const tasksHome: FeatureHome = {
  attention: {
    MY_TASK: {
      id: (item) => item.taskId,
      row: (item, { t, nav }) => ({
        icon: 'tasks',
        title: item.title,
        subtitle: item.dueOn
          ? t('home:attention.MY_TASK.sub', { date: day(item.dueOn, 'short') })
          : t('home:attention.MY_TASK.subNoDue'),
        trailing: item.returned ? (
          <StatusPill label={t('home:attention.MY_TASK.returned')} tone="warning" />
        ) : undefined,
        onPress: () => nav.navigate('TaskDetail', { taskId: item.taskId }),
      }),
      hero: {
        priority: 3,
        card: (item, { t, nav }) => ({
          photo: photos.tasks,
          label: t('home:hero.task.label'),
          value: item.title,
          caption: item.dueOn
            ? t('home:attention.MY_TASK.sub', { date: day(item.dueOn, 'short') })
            : undefined,
          cta: {
            label: t('home:hero.task.cta'),
            go: () => nav.navigate('TaskDetail', { taskId: item.taskId }),
          },
        }),
      },
    },
    TASKS_TO_VERIFY: {
      row: (item, { t, nav }) => ({
        icon: 'taskDone',
        title: t('home:attention.TASKS_TO_VERIFY.title', { count: item.count }),
        subtitle: t('home:attention.TASKS_TO_VERIFY.sub'),
        onPress: () => nav.navigate('Tasks', { view: 'TO_VERIFY' }),
      }),
    },
  },
};
