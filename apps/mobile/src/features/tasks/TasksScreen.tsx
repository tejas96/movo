import type { TaskView } from '@movo/contracts';
import {
  Card,
  Chip,
  EmptyState,
  IconSquare,
  Screen,
  Skeleton,
  TitleBar,
} from '@movo/design-system';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { type RootStackParamList, useNav } from '../../core/navigation/types';
import { useCan, useSocietyId } from '../../core/tenant/hooks';
import { useTasks } from './api';
import { TaskRow } from './shared';

export function TasksScreen() {
  const { t } = useTranslation(['tasks', 'common']);
  const nav = useNav();
  const societyId = useSocietyId();
  const canManage = useCan('task.manage');
  const canVerify = useCan('task.verify');
  const initial = useRoute<RouteProp<RootStackParamList, 'Tasks'>>().params?.view;
  const [view, setView] = useState<TaskView>(initial ?? 'OPEN');
  const list = useTasks(societyId, view);
  const views: TaskView[] = [
    'OPEN',
    'MINE',
    'ACTIVE',
    'DONE',
    ...(canVerify ? (['TO_VERIFY'] as const) : []),
  ];
  const items = list.data ?? [];

  return (
    <Screen refreshing={list.isRefetching} onRefresh={() => void list.refetch()}>
      <TitleBar
        title={t('tasks:title')}
        onBack={() => nav.goBack()}
        trailing={
          canManage ? (
            <IconSquare
              icon="add"
              variant="linear"
              tone="ink"
              onPress={() => nav.navigate('TaskEditor')}
            />
          ) : undefined
        }
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="-mx-5 mt-4"
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
      >
        {views.map((v) => (
          <Chip
            key={v}
            label={t(`tasks:views.${v}`)}
            selected={view === v}
            onPress={() => setView(v)}
          />
        ))}
      </ScrollView>
      {list.isLoading ? (
        <Skeleton className="mt-4 h-40 rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState icon="tasks" title={t(`tasks:empty.${view}`)} className="mt-10" />
      ) : (
        <Card tight className="mt-4 gap-1">
          {items.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
