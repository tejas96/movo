import type { TaskView } from '@movo/contracts';
import { editorOptions, type FeatureRoutes } from '../../core/navigation/routes';
import { TaskDetailScreen } from './TaskDetailScreen';
import { TaskEditorScreen } from './TaskEditorScreen';
import { TasksScreen } from './TasksScreen';

export type TasksParams = {
  Tasks: { view?: TaskView } | undefined;
  TaskDetail: { taskId: string };
  TaskEditor: { taskId?: string } | undefined;
};

export const tasksRoutes: FeatureRoutes<TasksParams> = {
  screens: [
    { name: 'Tasks', component: TasksScreen, group: 'app' },
    { name: 'TaskDetail', component: TaskDetailScreen, group: 'app' },
    { name: 'TaskEditor', component: TaskEditorScreen, group: 'app', options: editorOptions },
  ],
  notifications: [{ kind: 'task', route: 'TaskDetail', param: 'taskId' }],
};
