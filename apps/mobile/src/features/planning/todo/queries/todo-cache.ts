import { invalidateTodoCategories } from '@src/features/planning/category/queries/todo-category-cache';
import type { Query, QueryClient } from '@tanstack/react-query';

import { TODO_MUTATION_KEYS } from '../constants/todo-mutation-keys';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { DailyCompletionPolicy } from '../domains/daily-completion.model';
import {
  type DailyCompletionsResult,
  type Todo,
  type TodoDetails,
  type TodoListResult,
} from '../schemas/todo.schema';

export interface TodoSnapshot {
  date: string;
  todo: Todo;
  index: number;
}

/** 낙관적 값을 쓰기 전에 그 값을 덮을 수 있는 그 날짜 목록·상세 조회를 멈춘다. */
export function cancelTodoQueries(
  queryClient: QueryClient,
  { date, todoId }: { date: string; todoId?: number },
) {
  return Promise.all([
    queryClient.cancelQueries({ queryKey: TODO_QUERY_KEYS.listByDate({ date }) }),
    todoId != null && queryClient.cancelQueries({ queryKey: TODO_QUERY_KEYS.details({ todoId }) }),
  ]);
}

export function cancelTodoCompletionQueries(
  queryClient: QueryClient,
  target: { date: string; todoId?: number },
) {
  return Promise.all([
    cancelTodoQueries(queryClient, target),
    queryClient.cancelQueries({ queryKey: TODO_QUERY_KEYS.completionRanges() }),
  ]);
}

export function snapshotTodo(
  queryClient: QueryClient,
  { date, todoId }: { date: string; todoId: number },
): TodoSnapshot | null {
  const todos = getCachedTodosByDate(queryClient, { date }) ?? [];
  const index = todos.findIndex((todo) => todo.id === todoId);
  const todo = todos[index];

  if (todo == null) {
    return null;
  }

  return { date, todo, index };
}

/** 그 날짜 목록에 지금 보이는 할 일. 아직 불러오지 않았으면 undefined */
export function getCachedTodosByDate(
  queryClient: QueryClient,
  { date }: { date: string },
): Todo[] | undefined {
  return queryClient.getQueryData<TodoListResult>(TODO_QUERY_KEYS.listByDate({ date }))?.todos;
}

/** 이미 불러온 모든 날짜의 할 일 제목. 따로 요청하지 않는다 */
export function getCachedTodoTitles(queryClient: QueryClient): string[] {
  return queryClient
    .getQueriesData<TodoListResult>({ queryKey: TODO_QUERY_KEYS.lists() })
    .flatMap(([, data]) => (data?.todos ?? []).map((todo) => todo.title));
}

export function updateCachedTodo(
  queryClient: QueryClient,
  { date, todoId }: { date: string; todoId: number },
  update: (todo: Todo) => Todo,
) {
  queryClient.setQueryData<TodoListResult>(
    TODO_QUERY_KEYS.listByDate({ date }),
    (old) =>
      old && { ...old, todos: old.todos.map((todo) => (todo.id === todoId ? update(todo) : todo)) },
  );
  queryClient.setQueryData<TodoDetails>(
    TODO_QUERY_KEYS.details({ todoId }),
    (old) => old && { ...old, todo: update(old.todo) },
  );
}

export function appendTodoToList(queryClient: QueryClient, { date }: { date: string }, todo: Todo) {
  queryClient.setQueryData<TodoListResult>(
    TODO_QUERY_KEYS.listByDate({ date }),
    (old) => old && { ...old, todos: [...old.todos, todo] },
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

export function confirmTodoInList(
  queryClient: QueryClient,
  { date, optimisticId }: { date: string; optimisticId: number },
  saved: Todo,
) {
  queryClient.setQueryData<TodoListResult>(
    TODO_QUERY_KEYS.listByDate({ date }),
    (old) =>
      old && {
        ...old,
        todos: old.todos.map((todo) => (todo.id === optimisticId ? saved : todo)),
      },
  );
}

/** 삭제에 실패한 할 일 하나만 되돌린다. 같은 날짜의 다른 변경은 보존한다. */
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

/** 조회 옵션이 `meta.refreshOnTodoChange`로 할 일에 따라 보이는 값이 달라진다고 밝힌 쿼리 */
function isTodoDependentQuery(query: Pick<Query, 'meta'>) {
  return query.meta?.refreshOnTodoChange === true;
}

/** 할 일이 바뀌면 보이는 값이 달라지는 다른 피처의 조회(콕 상태 등)를 다시 불러온다. */
export function invalidateTodoDependentQueries(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ predicate: isTodoDependentQuery });
}

/** 다른 피처가 할 일을 만들거나 바꾼 뒤 할 일·카테고리 화면을 다시 불러온다. */
export function invalidateTodos(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.all }),
    invalidateTodoCategories(queryClient),
    invalidateTodoDependentQueries(queryClient),
  ]);
}

export function invalidateTodoDetails(queryClient: QueryClient, { todoId }: { todoId: number }) {
  return queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.details({ todoId }) });
}

/**
 * 그날 목록으로 달력 요약을 맞춘다. 증감이 아니라 목록에서 계산해 낙관적 반영·되돌리기가 같은 함수로 끝난다.
 * 목록이 잘려 있으면(서버 한도 초과) 셀 수 없으니 서버 값을 기다린다.
 */
export function syncDailyCompletionWithList(queryClient: QueryClient, { date }: { date: string }) {
  const list = queryClient.getQueryData<TodoListResult>(TODO_QUERY_KEYS.listByDate({ date }));
  if (list == null || list.hasNext) {
    return;
  }
  queryClient.setQueriesData<DailyCompletionsResult>(
    { queryKey: TODO_QUERY_KEYS.completionRanges() },
    (old) => old && DailyCompletionPolicy.withDailyCompletionFromTodos(old, date, list.todos),
  );
}

/**
 * 목록을 고친 뮤테이션이 끝날 때 서버 값으로 맞춘다. 앞선 응답으로 다시 받으면 뒤따라 진행 중인 낙관적 값이
 * 되돌아가므로 마지막 하나가 끝날 때만 받는다. 여러 날 할 일은 다른 날짜 목록에도 있어 날짜를 가리지 않는다
 * (화면에 붙은 조회만 다시 받고 나머지는 낡음 표시만 남는다).
 */
export function settleTodoListWrite(queryClient: QueryClient) {
  if (queryClient.isMutating({ mutationKey: TODO_MUTATION_KEYS.listWrites() }) !== 1) {
    return;
  }
  queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() });
  queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.pages() });
}

export function settleTodoCompletionWrite(queryClient: QueryClient) {
  settleTodoListWrite(queryClient);
  if (queryClient.isMutating({ mutationKey: TODO_MUTATION_KEYS.completionWrites() }) !== 1) {
    return;
  }
  queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() });
}

/** 순서처럼 완료와 무관하게 홈 위젯 요약에 보이는 값이 바뀐 뒤 위젯 요약만 다시 불러온다. */
export function invalidateWidgetSummary(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.widgetSummary() });
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

/** 피드의 할 일 목록과 완료 통계를 다시 불러온다. 피드 새로고침과 카테고리 수정이 쓴다. */
export function invalidateFeedTodos(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.lists() }),
    queryClient.invalidateQueries({ queryKey: TODO_QUERY_KEYS.completions() }),
  ]);
}
