import type { QueryClient } from '@tanstack/react-query';

import { TODO_CATEGORY_QUERY_KEYS } from '../constants/todo-category-query-keys';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import type { Todo, TodoListResult } from '../domains/todo.model';

export interface TodoSnapshot {
  date: string;
  todo: Todo;
  index: number;
}

let nextOptimisticId = -1;

/** 서버 id와 겹치지 않는 음의 정수 id. 응답 후 목록을 다시 불러오면 사라진다. */
export function createOptimisticId(): number {
  return nextOptimisticId--;
}

export function cancelTodoListQuery(queryClient: QueryClient, { date }: { date: string }) {
  return queryClient.cancelQueries({ queryKey: TODO_QUERY_KEYS.listByDate({ date }) });
}

export function snapshotTodo(
  queryClient: QueryClient,
  { date, todoId }: { date: string; todoId: number },
): TodoSnapshot | null {
  const todos =
    queryClient.getQueryData<TodoListResult>(TODO_QUERY_KEYS.listByDate({ date }))?.todos ?? [];
  const index = todos.findIndex((todo) => todo.id === todoId);
  const todo = todos[index];

  if (todo == null) {
    return null;
  }

  return { date, todo, index };
}

export function updateTodoInList(
  queryClient: QueryClient,
  { date, todoId }: { date: string; todoId: number },
  update: (todo: Todo) => Todo,
) {
  queryClient.setQueryData<TodoListResult>(
    TODO_QUERY_KEYS.listByDate({ date }),
    (old) =>
      old && { ...old, todos: old.todos.map((todo) => (todo.id === todoId ? update(todo) : todo)) },
  );
}

export function removeTodoFromList(
  queryClient: QueryClient,
  { date, todoId }: { date: string; todoId: number },
) {
  queryClient.setQueryData<TodoListResult>(
    TODO_QUERY_KEYS.listByDate({ date }),
    (old) => old && { ...old, todos: old.todos.filter((todo) => todo.id !== todoId) },
  );
}

/** 실패한 mutation이 건드린 할 일 하나만 되돌린다. 같은 날짜의 다른 변경은 보존한다. */
export function restoreTodo(queryClient: QueryClient, snapshot: TodoSnapshot) {
  queryClient.setQueryData<TodoListResult>(
    TODO_QUERY_KEYS.listByDate({ date: snapshot.date }),
    (old) => {
      if (!old) {
        return old;
      }

      if (old.todos.some((todo) => todo.id === snapshot.todo.id)) {
        return {
          ...old,
          todos: old.todos.map((todo) => (todo.id === snapshot.todo.id ? snapshot.todo : todo)),
        };
      }

      return {
        ...old,
        todos: [
          ...old.todos.slice(0, snapshot.index),
          snapshot.todo,
          ...old.todos.slice(snapshot.index),
        ],
      };
    },
  );
}

/** 다른 피처가 할 일을 만들거나 바꾼 뒤 할 일·카테고리 화면을 다시 불러온다. */
export function invalidateTodos(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all }),
    queryClient.invalidateQueries({ queryKey: TODO_CATEGORY_QUERY_KEYS.all }),
  ]);
}

export function invalidateTodoDetails(queryClient: QueryClient, { todoId }: { todoId: number }) {
  return queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.details({ todoId }) });
}

/** 댓글 수처럼 목록·친구 목록·상세에 함께 보이는 할 일 요약 값을 다시 불러온다. */
export async function invalidateTodoSummaries(
  queryClient: QueryClient,
  { todoId }: { todoId: number },
): Promise<void> {
  await Promise.all([
    invalidateTodoDetails(queryClient, { todoId }),
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() }),
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.friendLists() }),
  ]);
}

export function invalidateFriendTodos(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.friendLists() });
}

/** 피드 당겨서 새로고침 때 할 일 목록과 완료 통계를 다시 불러온다. */
export function invalidateFeedTodos(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() }),
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() }),
  ]);
}
