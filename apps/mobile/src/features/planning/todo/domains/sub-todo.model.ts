import { TODO_ITEM_LIMITS } from '@aido/api/vocabulary';
import { z } from 'zod';

import type { Todo } from './todo.model';

export const subTodoSchema = z.object({
  id: z.int(),
  title: z.string(),
  completed: z.boolean(),
  sortOrder: z.int(),
});
export type SubTodo = z.infer<typeof subTodoSchema>;

/** 진행 막대·"2/4" 숫자. 서버 itemStats도 items에서 계산해 앱은 항목 목록 하나만 둔다 */
export interface SubTodoStats {
  total: number;
  completed: number;
}

// 서버 응답 전의 임시 항목. 임시 id로는 체크·수정·순서 변경 요청을 보낼 수 없다
export function isOptimisticSubTodo(subTodo: SubTodo): boolean {
  return subTodo.id < 0;
}

// 목록에서만 계산한다. 숫자를 따로 두고 ±1 하면 같은 변경이 두 번 들어올 때 1/1이 2/1처럼 어긋난다
export function getSubTodoStats(subTodos: readonly SubTodo[]): SubTodoStats {
  return {
    total: subTodos.length,
    completed: subTodos.filter((subTodo) => subTodo.completed).length,
  };
}

export function hasSubTodos(subTodos: readonly SubTodo[]): boolean {
  return subTodos.length > 0;
}

function setSubTodoCompleted(
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

function withSubTodos(todo: Todo, subTodos: SubTodo[]): Todo {
  return { ...todo, subTodos };
}

export function canAddSubTodo(subTodos: readonly SubTodo[]): boolean {
  return subTodos.length < TODO_ITEM_LIMITS.MAX_PER_TODO;
}

export function withSubTodoCompleted(todo: Todo, subTodoId: number, completed: boolean): Todo {
  return withSubTodos(todo, setSubTodoCompleted(todo.subTodos, subTodoId, completed));
}

// 서버와 같은 규칙이다. 끝낸 일에 항목을 더하면 남은 일이 생겨 완료가 풀린다
export function withSubTodoAdded(todo: Todo, subTodo: SubTodo): Todo {
  return { ...withSubTodos(todo, addSubTodo(todo.subTodos, subTodo)), completed: false };
}

export function withSubTodoRemoved(todo: Todo, subTodoId: number): Todo {
  return withSubTodos(todo, removeSubTodo(todo.subTodos, subTodoId));
}

export function withSubTodoRenamed(todo: Todo, subTodoId: number, title: string): Todo {
  return withSubTodos(
    todo,
    todo.subTodos.map((subTodo) => (subTodo.id === subTodoId ? { ...subTodo, title } : subTodo)),
  );
}

export function withSubTodoRestored(todo: Todo, subTodo: SubTodo, index: number): Todo {
  if (todo.subTodos.some(({ id }) => id === subTodo.id)) {
    return todo;
  }
  return withSubTodos(todo, [
    ...todo.subTodos.slice(0, index),
    subTodo,
    ...todo.subTodos.slice(index),
  ]);
}

// 받은 순서대로 놓는다. 순서를 정할 때 없던 항목(그 사이 추가)은 뒤에 남긴다
export function withSubTodosOrdered(todo: Todo, subTodoIds: readonly number[]): Todo {
  const listed = subTodoIds.flatMap((id) => todo.subTodos.filter((subTodo) => subTodo.id === id));
  const rest = todo.subTodos.filter((subTodo) => !subTodoIds.includes(subTodo.id));
  return withSubTodos(todo, [...listed, ...rest]);
}

// 임시 항목을 응답에 새로 생긴 같은 제목의 항목으로 바꾼다. 다른 항목의 진행 중인 변경은 지킨다
export function withSubTodoConfirmed(
  todo: Todo,
  optimisticId: number,
  saved: { subTodos: readonly SubTodo[] },
): Todo {
  const optimistic = todo.subTodos.find((subTodo) => subTodo.id === optimisticId);
  const confirmed = saved.subTodos.find(
    (subTodo) =>
      subTodo.title === optimistic?.title && !todo.subTodos.some(({ id }) => id === subTodo.id),
  );
  if (confirmed == null) {
    return todo;
  }
  return withSubTodos(
    todo,
    todo.subTodos.map((subTodo) => (subTodo.id === optimisticId ? confirmed : subTodo)),
  );
}

// 제목이 그대로면 요청을 보내지 않는다
export function hasTitleChanged(subTodo: SubTodo, title: string): boolean {
  return subTodo.title !== title;
}

export const SubTodoPolicy = {
  getSubTodoStats,
  hasSubTodos,
  canAddSubTodo,
  isOptimisticSubTodo,
  hasTitleChanged,
  withSubTodoCompleted,
  withSubTodoAdded,
  withSubTodoRemoved,
  withSubTodoRenamed,
  withSubTodoRestored,
  withSubTodosOrdered,
  withSubTodoConfirmed,
} as const;
