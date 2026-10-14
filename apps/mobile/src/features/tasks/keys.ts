import { societyKey } from '../../core/api/query-keys';

export const tasksKeys = (societyId: string) => {
  const root = societyKey(societyId);
  return {
    all: [...root, 'tasks'] as const,
    list: (view: string) => [...root, 'tasks', 'list', view] as const,
    detail: (taskId: string) => [...root, 'tasks', 'one', taskId] as const,
  };
};
