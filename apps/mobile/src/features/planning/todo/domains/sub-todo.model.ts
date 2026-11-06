import { TODO_ITEM_LIMITS } from '@aido/api/vocabulary';
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
type SubTodoStats = z.infer<typeof subTodoStatsSchema>;

type SubTodoParent = { subTodos: readonly SubTodo[]; subTodoStats: SubTodoStats };

/** 서버 응답 전의 임시 항목. 임시 id로는 체크·수정·순서 변경 요청을 보낼 수 없다 */
function isOptimisticSubTodo(subTodo: SubTodo): boolean {
  return subTodo.id < 0;
}

function isMaxSubTodosReached(stats: SubTodoStats): boolean {
  return stats.total >= TODO_ITEM_LIMITS.MAX_PER_TODO;
}

// 통계는 목록에서만 계산한다. 이전 통계에 ±1을 하면 같은 변경이 두 번 들어올 때 1/1이 2/1처럼 어긋난다
function calculateSubTodoStats(subTodos: readonly SubTodo[]): SubTodoStats {
  return {
    total: subTodos.length,
    completed: subTodos.filter((subTodo) => subTodo.completed).length,
  };
}

function toggleSubTodo(
  subTodos: readonly SubTodo[],
  subTodoId: number,
  completed: boolean,
): SubTodo[] {
  return subTodos.map((subTodo) =>
    subTodo.id === subTodoId ? { ...subTodo, completed } : subTodo,
  );
}

function addSubTodo(subTodos: readonly SubTodo[], subTodo: SubTodo): SubTodo[] {
  return [...subTodos, subTodo];
}

function removeSubTodo(subTodos: readonly SubTodo[], subTodoId: number): SubTodo[] {
  return subTodos.filter((subTodo) => subTodo.id !== subTodoId);
}

function withSubTodos<T extends SubTodoParent>(parent: T, subTodos: SubTodo[]): T {
  return { ...parent, subTodos, subTodoStats: calculateSubTodoStats(subTodos) };
}

function getCompletionRatio(stats: SubTodoStats): number {
  if (stats.total === 0) {
    return 0;
  }
  return stats.completed / stats.total;
}

function canAddSubTodo(parentTodo: { subTodoStats: SubTodoStats }): boolean {
  return !isMaxSubTodosReached(parentTodo.subTodoStats);
}

function getSubTodoCompletionProgress(parentTodo: { subTodoStats: SubTodoStats }): number {
  return getCompletionRatio(parentTodo.subTodoStats);
}

function withSubTodoToggled<T extends SubTodoParent>(
  parent: T,
  subTodoId: number,
  completed: boolean,
): T {
  return withSubTodos(parent, toggleSubTodo(parent.subTodos, subTodoId, completed));
}

/** 서버와 같은 규칙이다. 끝낸 일에 항목을 더하면 남은 일이 생겨 완료가 풀린다 */
function withSubTodoAdded<T extends SubTodoParent & { completed: boolean }>(
  parent: T,
  subTodo: SubTodo,
): T {
  return { ...withSubTodos(parent, addSubTodo(parent.subTodos, subTodo)), completed: false };
}

function withSubTodoRemoved<T extends SubTodoParent>(parent: T, subTodoId: number): T {
  return withSubTodos(parent, removeSubTodo(parent.subTodos, subTodoId));
}

function withSubTodoRenamed<T extends SubTodoParent>(
  parent: T,
  subTodoId: number,
  title: string,
): T {
  return withSubTodos(
    parent,
    parent.subTodos.map((subTodo) => (subTodo.id === subTodoId ? { ...subTodo, title } : subTodo)),
  );
}

function withSubTodoRestored<T extends SubTodoParent>(
  parent: T,
  subTodo: SubTodo,
  index: number,
): T {
  if (parent.subTodos.some(({ id }) => id === subTodo.id)) {
    return parent;
  }
  return withSubTodos(parent, [
    ...parent.subTodos.slice(0, index),
    subTodo,
    ...parent.subTodos.slice(index),
  ]);
}

/** 받은 순서대로 놓는다. 순서를 정할 때 없던 항목(그 사이 추가)은 뒤에 남긴다 */
function withSubTodosOrdered<T extends SubTodoParent>(parent: T, subTodoIds: readonly number[]): T {
  const listed = subTodoIds.flatMap((id) => parent.subTodos.filter((subTodo) => subTodo.id === id));
  const rest = parent.subTodos.filter((subTodo) => !subTodoIds.includes(subTodo.id));
  return withSubTodos(parent, [...listed, ...rest]);
}

/** 임시 항목을 응답에 새로 생긴 같은 제목의 항목으로 바꾼다. 다른 항목의 진행 중인 변경은 지킨다 */
function withSubTodoConfirmed<T extends SubTodoParent>(
  parent: T,
  optimisticId: number,
  saved: { subTodos: readonly SubTodo[] },
): T {
  const optimistic = parent.subTodos.find((subTodo) => subTodo.id === optimisticId);
  const confirmed = saved.subTodos.find(
    (subTodo) =>
      subTodo.title === optimistic?.title && !parent.subTodos.some(({ id }) => id === subTodo.id),
  );
  if (confirmed == null) {
    return parent;
  }
  return withSubTodos(
    parent,
    parent.subTodos.map((subTodo) => (subTodo.id === optimisticId ? confirmed : subTodo)),
  );
}

/** 제목이 그대로면 요청을 보내지 않는다 */
function hasTitleChanged(subTodo: Pick<SubTodo, 'title'>, title: string): boolean {
  return subTodo.title !== title;
}

export const SubTodoPolicy = {
  canAddSubTodo,
  isOptimisticSubTodo,
  getSubTodoCompletionProgress,
  hasTitleChanged,
  withSubTodoToggled,
  withSubTodoAdded,
  withSubTodoRemoved,
  withSubTodoRenamed,
  withSubTodoRestored,
  withSubTodosOrdered,
  withSubTodoConfirmed,
} as const;
