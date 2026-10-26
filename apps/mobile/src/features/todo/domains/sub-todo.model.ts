import { TODO_ITEM_LIMITS } from '@aido/api';
import { z } from 'zod';

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

type SubTodoParent = { subTodos: readonly SubTodo[]; subTodoStats: SubTodoStats };

function isMaxSubTodosReached(stats: SubTodoStats): boolean {
  return stats.total >= TODO_ITEM_LIMITS.MAX_PER_TODO;
}

// 통계는 목록에서만 계산한다. 이전 통계에 ±1을 하면 같은 변경이 두 번 들어올 때 1/1이 2/1처럼 어긋난다
export function calculateSubTodoStats(subTodos: readonly SubTodo[]): SubTodoStats {
  return {
    total: subTodos.length,
    completed: subTodos.filter((subTodo) => subTodo.completed).length,
  };
}

export function toggleSubTodo(
  subTodos: readonly SubTodo[],
  subTodoId: number,
  completed: boolean,
): SubTodo[] {
  return subTodos.map((subTodo) =>
    subTodo.id === subTodoId ? { ...subTodo, completed } : subTodo,
  );
}

export function addSubTodo(subTodos: readonly SubTodo[], subTodo: SubTodo): SubTodo[] {
  return [...subTodos, subTodo];
}

export function removeSubTodo(subTodos: readonly SubTodo[], subTodoId: number): SubTodo[] {
  return subTodos.filter((subTodo) => subTodo.id !== subTodoId);
}

function withSubTodos<T extends SubTodoParent>(parent: T, subTodos: SubTodo[]): T {
  return { ...parent, subTodos, subTodoStats: calculateSubTodoStats(subTodos) };
}

function completionProgress(stats: SubTodoStats): number {
  if (stats.total === 0) {
    return 0;
  }
  return stats.completed / stats.total;
}

export function canAddSubTodo(parentTodo: { subTodoStats: SubTodoStats }): boolean {
  return !isMaxSubTodosReached(parentTodo.subTodoStats);
}

export function getSubTodoCompletionProgress(parentTodo: { subTodoStats: SubTodoStats }): number {
  return completionProgress(parentTodo.subTodoStats);
}

export const SubTodoPolicy = {
  canAddSubTodo,
  completionProgress: getSubTodoCompletionProgress,

  withSubTodoToggled<T extends SubTodoParent>(parent: T, subTodoId: number, completed: boolean): T {
    return withSubTodos(parent, toggleSubTodo(parent.subTodos, subTodoId, completed));
  },

  withSubTodoAdded<T extends SubTodoParent>(parent: T, subTodo: SubTodo): T {
    return withSubTodos(parent, addSubTodo(parent.subTodos, subTodo));
  },

  withSubTodoRemoved<T extends SubTodoParent>(parent: T, subTodoId: number): T {
    return withSubTodos(parent, removeSubTodo(parent.subTodos, subTodoId));
  },
} as const;
