import type { QueryClient } from '@tanstack/react-query';

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
