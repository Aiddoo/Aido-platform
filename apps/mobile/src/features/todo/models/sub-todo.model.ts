import { TODO_ITEM_LIMITS } from '@aido/validators';
import { z } from 'zod';
import type { TodoItem } from './todo.model';

export const subTodoSchema = z.object({
  id: z.number(),
  title: z.string(),
  completed: z.boolean(),
  sortOrder: z.number(),
});
export type SubTodo = z.infer<typeof subTodoSchema>;

export const subTodoStatsSchema = z.object({
  total: z.number(),
  completed: z.number(),
});
export type SubTodoStats = z.infer<typeof subTodoStatsSchema>;

function isMaxSubTodosReached(stats: SubTodoStats): boolean {
  return stats.total >= TODO_ITEM_LIMITS.MAX_PER_TODO;
}

function statsAfterToggle(stats: SubTodoStats, completed: boolean): SubTodoStats {
  return {
    total: stats.total,
    completed: completed ? stats.completed + 1 : stats.completed - 1,
  };
}

function statsAfterAdd(stats: SubTodoStats): SubTodoStats {
  return { total: stats.total + 1, completed: stats.completed };
}

function statsAfterDelete(stats: SubTodoStats, wasCompleted: boolean): SubTodoStats {
  return {
    total: stats.total - 1,
    completed: wasCompleted ? stats.completed - 1 : stats.completed,
  };
}

function completionProgress(stats: SubTodoStats): number {
  if (stats.total === 0) {
    return 0;
  }
  return stats.completed / stats.total;
}

export const SubTodoPolicy = {
  canAddSubTodo(parentTodo: TodoItem): boolean {
    return !isMaxSubTodosReached(parentTodo.subTodoStats);
  },

  statsAfterToggle(parentTodo: TodoItem, completed: boolean): SubTodoStats {
    return statsAfterToggle(parentTodo.subTodoStats, completed);
  },

  statsAfterAdd(parentTodo: TodoItem): SubTodoStats {
    return statsAfterAdd(parentTodo.subTodoStats);
  },

  statsAfterDelete(parentTodo: TodoItem, subTodoId: number): SubTodoStats {
    const deleted = parentTodo.subTodos.find((subTodo) => subTodo.id === subTodoId);
    return statsAfterDelete(parentTodo.subTodoStats, deleted?.completed ?? false);
  },

  completionProgress(parentTodo: TodoItem): number {
    return completionProgress(parentTodo.subTodoStats);
  },
} as const;
