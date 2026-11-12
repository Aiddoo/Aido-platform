import type { FriendTodo, Todo as TodoDto, TodoItemResponse } from '@aido/api';
import type { ApiError } from '@src/core/errors/api-error';
import { err, ok, type Result } from '@src/core/errors/result';
import { createTodoCategoryListDto } from '@src/features/planning/category/__tests__/todo-category.fixtures';
import '@src/shared/i18n/init';
import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/queries/todo-category-query-keys';
import { useGetTodoCategoriesQueryOptions } from '@src/features/planning/category/queries/todo-category.queries';
import {
  createDailyCompletionsDto,
  createTodoApiError,
  createTodoDto,
  createTodoFormValues,
  createTodoItemResponseDto,
  createTodoListResponseDto,
} from '@src/features/planning/todo/__tests__/todo.fixtures';
import { SubTodoPolicy } from '@src/features/planning/todo/domains/sub-todo.model';
import {
  useDeleteSubTodoMutationOptions,
  useReorderSubTodosMutationOptions,
  useToggleSubTodoMutationOptions,
} from '@src/features/planning/todo/queries/sub-todo.mutations';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import {
  useChangeTodoCategoryMutationOptions,
  useDeleteTodoMutationOptions,
  useReorderTodoMutationOptions,
  useToggleTodoMutationOptions,
  useUpdateTodoScheduleMutationOptions,
} from '@src/features/planning/todo/queries/todo.mutations';
import {
  useGetDailyCompletionsQueryOptions,
  useGetFriendTodosQueryOptions,
  useGetTodoDetailsQueryOptions,
  useGetTodoOverviewQueryOptions,
  useGetTodosByDateQueryOptions,
  useGetTodoSummaryQueryOptions,
} from '@src/features/planning/todo/queries/todo.queries';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import {
  createHttpClientStub,
  createPendingResponse,
  createTestQueryClient,
  deliverQueryNotifications,
  createTestDi,
} from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreen } from '@src/testing/render';
import { hashKey, type QueryKey, useMutation, useQuery } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';
import { noop } from 'es-toolkit';
import { Profiler } from 'react';

import {
  useAddSubTodoMutationOptions,
  useCreateTodoMutationOptions,
  useUpdateSubTodoMutationOptions,
  useUpdateTodoMutationOptions,
} from './todo-composer.mutations';

const DAY = createDateKey('2026-03-08');
const OTHER_DAY = createDateKey('2026-03-20');
const MOVED_DAY = createDateKey('2026-04-20');
const MONTH = { startDate: createDateKey('2026-02-23'), endDate: createDateKey('2026-04-05') };
const NEXT_MONTH = { startDate: createDateKey('2026-04-06'), endDate: createDateKey('2026-05-10') };
const FRIEND_ID = 'friend-1';
const OWNER_ID = 'clz7x5p8k0010qz0z8z8z8z8z';

/** 보는 화면이 붙들고 있는 조회. 이름으로 다시 받은 조회를 읽는다 */
const WATCHED: Record<string, QueryKey> = {
  'list:day': TODO_QUERY_KEYS.listByDate({ date: DAY }),
  'list:other-day': TODO_QUERY_KEYS.listByDate({ date: OTHER_DAY }),
  'calendar:month': TODO_QUERY_KEYS.completionsByRange(MONTH),
  'calendar:next-month': TODO_QUERY_KEYS.completionsByRange(NEXT_MONTH),
  'widget:day': TODO_QUERY_KEYS.widgetSummaryByDate({ date: DAY, userId: null }),
  overview: TODO_QUERY_KEYS.overview(),
  categories: TODO_CATEGORY_QUERY_KEYS.list(),
  'friend:day': TODO_QUERY_KEYS.friendListByDate({ userId: FRIEND_ID, date: DAY }),
  'detail:1': TODO_QUERY_KEYS.detail({ todoId: 1 }),
};

function item(id: number, completed = false): TodoItemResponse {
  return createTodoItemResponseDto({ id, title: `항목 ${id}`, completed, sortOrder: id });
}

/** 서버처럼 요청을 받은 순간 고치고, 조회에는 그 상태를 돌려준다. 쓰기 응답이 오는 때는 테스트가 정한다 */
function createTodoServer() {
  const state = {
    todos: [
      createTodoDto({ id: 1, startDate: DAY, items: [item(11), item(12, true)] }),
      createTodoDto({ id: 2, startDate: DAY, sortOrder: 1 }),
      createTodoDto({ id: 3, startDate: DAY, sortOrder: 2, completed: true }),
      createTodoDto({ id: 4, startDate: OTHER_DAY }),
    ],
    nextId: 501,
  };
  const withStats = (todo: TodoDto): TodoDto => ({
    ...todo,
    itemStats: {
      total: todo.items.length,
      completed: todo.items.filter((each) => each.completed).length,
    },
  });
  const find = (todoId: number) => state.todos.find((todo) => todo.id === todoId);
  const replace = (todoId: number, update: (todo: TodoDto) => TodoDto) => {
    state.todos = state.todos.map((todo) => (todo.id === todoId ? withStats(update(todo)) : todo));
    return { message: 'ok', todo: find(todoId) };
  };
  const isOn = (todo: TodoDto, date: string) =>
    todo.startDate <= date && date <= (todo.endDate ?? todo.startDate);

  function get(url: string, params: Record<string, unknown> = {}): unknown {
    if (url === 'v1/todo-categories') {
      return createTodoCategoryListDto();
    }
    if (url === 'v1/todos/overview') {
      return {
        hasTodo: state.todos.length > 0,
        hasCompletedTodo: state.todos.some((todo) => todo.completed),
        hasActiveRepeat: state.todos.some((todo) => todo.recurrenceGroupId != null),
      };
    }
    if (url === 'v1/todos/summary') {
      const dayTodos = state.todos.filter((todo) => isOn(todo, String(params.date)));
      const completedTodos = dayTodos.filter((todo) => todo.completed).length;
      return {
        date: params.date,
        totalTodos: dayTodos.length,
        completedTodos,
        completionRate: 0,
        isComplete: false,
        currentStreak: 0,
        topTodos: [],
      };
    }
    if (url === 'v1/daily-completions') {
      const startDate = String(params.startDate);
      const endDate = String(params.endDate);
      const dates = [...new Set(state.todos.map((todo) => todo.startDate))].filter(
        (date) => startDate <= date && date <= endDate,
      );
      const completions = dates.sort().map((date) => {
        const dayTodos = state.todos.filter((todo) => todo.startDate === date);
        const completedTodos = dayTodos.filter((todo) => todo.completed).length;
        return {
          date,
          totalTodos: dayTodos.length,
          completedTodos,
          isComplete: completedTodos === dayTodos.length,
          completionRate: Math.round((completedTodos / dayTodos.length) * 100),
          categoryColors: [...new Set(dayTodos.map((todo) => todo.category.color))].sort(),
        };
      });
      return {
        completions,
        totalCompleteDays: completions.filter((completion) => completion.isComplete).length,
        dateRange: { startDate, endDate },
      };
    }
    if (url.startsWith('v1/todos/friends/')) {
      const items: FriendTodo[] = [];
      return { items, pagination: { hasNext: false, nextCursor: null, size: 50 } };
    }
    const details = /^v1\/todos\/(\d+)\/details$/.exec(url);
    if (details != null) {
      return {
        todo: find(Number(details[1])),
        owner: { id: OWNER_ID, name: '나', profileImage: null },
        permissions: { canEdit: true, canComment: true, canNudge: false },
        metrics: { viewCount: 0, commentCount: 0 },
      };
    }
    const todos = state.todos.filter(
      (todo) =>
        (params.startDate == null || isOn(todo, String(params.startDate))) &&
        (params.completed == null || todo.completed === params.completed),
    );
    const size = typeof params.size === 'number' ? params.size : todos.length;
    return {
      items: todos.slice(0, size),
      pagination: { hasNext: false, nextCursor: null, size },
    };
  }

  function write(method: 'post' | 'patch' | 'delete', url: string, body: unknown): unknown {
    const input = typeof body === 'object' && body != null ? body : {};
    const path = url.replace(/^v1\/todos\/?/, '').split('/');
    const todoId = Number(path[0]);
    if (method === 'post' && url === 'v1/todos') {
      const title = 'title' in input ? String(input.title) : '';
      const created = createTodoDto({ id: state.nextId, title, startDate: DAY, sortOrder: 9 });
      state.nextId += 1;
      state.todos = [...state.todos, created];
      return { message: 'ok', todo: created };
    }
    if (path[1] === 'complete') {
      return replace(todoId, (todo) => ({
        ...todo,
        completed: 'completed' in input && input.completed === true,
      }));
    }
    if (path[1] === 'items' && method === 'post') {
      const title = 'title' in input ? String(input.title) : '';
      // 끝낸 일에 항목을 더하면 서버가 완료를 푼다
      return replace(todoId, (todo) => ({
        ...todo,
        completed: false,
        items: [...todo.items, { ...item(state.nextId++), title }],
      }));
    }
    if (path[1] === 'items' && path[2] === 'reorder') {
      const itemIds = 'itemIds' in input && Array.isArray(input.itemIds) ? input.itemIds : [];
      return replace(todoId, (todo) => ({
        ...todo,
        items: itemIds.flatMap((id) => todo.items.filter((each) => each.id === id)),
      }));
    }
    if (path[1] === 'items') {
      const itemId = Number(path[2]);
      if (method === 'delete') {
        return replace(todoId, (todo) => ({
          ...todo,
          items: todo.items.filter((each) => each.id !== itemId),
        }));
      }
      return replace(todoId, (todo) => ({
        ...todo,
        items: todo.items.map((each) => (each.id === itemId ? { ...each, ...input } : each)),
      }));
    }
    if (method === 'delete') {
      state.todos = state.todos.filter((todo) => todo.id !== todoId);
      return { message: 'ok' };
    }
    if (path[1] === 'reorder') {
      return replace(todoId, (todo) => todo);
    }
    if (path[1] === 'category') {
      const categoryId = 'categoryId' in input ? Number(input.categoryId) : 0;
      const category =
        createTodoCategoryListDto().items.find((each) => each.id === categoryId) ?? null;
      return replace(todoId, (todo) =>
        category == null
          ? todo
          : {
              ...todo,
              category: {
                id: category.id,
                name: category.name,
                color: category.color,
                sortOrder: category.sortOrder,
              },
            },
      );
    }
    return replace(todoId, (todo) => ({
      ...todo,
      ...('title' in input && typeof input.title === 'string' && { title: input.title }),
      ...('startDate' in input &&
        typeof input.startDate === 'string' && { startDate: input.startDate }),
    }));
  }

  return { state, get, write, find };
}

function WatchedQueries() {
  useQuery(useGetTodosByDateQueryOptions({ date: OTHER_DAY }));
  useQuery(useGetDailyCompletionsQueryOptions(NEXT_MONTH));
  useQuery(useGetTodoSummaryQueryOptions({ date: DAY }));
  useQuery(useGetTodoOverviewQueryOptions());
  useQuery(useGetTodoCategoriesQueryOptions());
  useQuery(useGetFriendTodosQueryOptions({ friendUserId: FRIEND_ID, date: DAY }));
  return null;
}

function CalendarProbe() {
  // MyCalendar처럼 data와 isError만 읽는다
  const query = useQuery(useGetDailyCompletionsQueryOptions(MONTH));
  return query.isError || query.data == null ? null : null;
}

function ListProbe() {
  // TodoList처럼 목록 data와 dataUpdatedAt을 읽는다
  const list = useQuery(useGetTodosByDateQueryOptions({ date: DAY }));
  return list.data == null || list.dataUpdatedAt < 0 ? null : null;
}

function DetailProbe() {
  const detail = useQuery(useGetTodoDetailsQueryOptions({ todoId: 1 }));
  return detail.data == null ? null : null;
}

function useTodoWrites() {
  return {
    createTodo: useMutation(useCreateTodoMutationOptions()),
    toggleTodo: useMutation(useToggleTodoMutationOptions()),
    deleteTodo: useMutation(useDeleteTodoMutationOptions()),
    reorderTodo: useMutation(useReorderTodoMutationOptions()),
    updateTodo: useMutation(useUpdateTodoMutationOptions()),
    updateSchedule: useMutation(useUpdateTodoScheduleMutationOptions()),
    changeCategory: useMutation(useChangeTodoCategoryMutationOptions()),
    addSubTodo: useMutation(useAddSubTodoMutationOptions()),
    toggleSubTodo: useMutation(useToggleSubTodoMutationOptions()),
    updateSubTodo: useMutation(useUpdateSubTodoMutationOptions()),
    deleteSubTodo: useMutation(useDeleteSubTodoMutationOptions()),
    reorderSubTodos: useMutation(useReorderSubTodosMutationOptions()),
  };
}
type TodoWrites = ReturnType<typeof useTodoWrites>;

async function renderFeed() {
  const server = createTodoServer();
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (url, options) => ok(server.get(url, options?.params)));
  /** 쓰기 응답을 붙잡아 두었다가 settle로 돌려준다. 서버 상태는 요청을 받는 순간 바뀐다 */
  const heldWrites: Array<() => void> = [];
  const failing = { next: false };
  const holdWrite =
    (method: 'post' | 'patch' | 'delete') =>
    (url: string, bodyOrOptions?: unknown): Promise<Result<unknown, ApiError>> => {
      // 거절한 쓰기는 서버 상태를 바꾸지 않는다
      const result = failing.next
        ? err(createTodoApiError())
        : ok(server.write(method, url, method === 'delete' ? undefined : bodyOrOptions));
      failing.next = false;
      const pending = createPendingResponse<Result<unknown, ApiError>>(result);
      heldWrites.push(pending.settle);
      return pending.response;
    };
  httpClient.post.mockImplementation(holdWrite('post'));
  httpClient.patch.mockImplementation(holdWrite('patch'));
  httpClient.delete.mockImplementation(holdWrite('delete'));
  // 운영처럼 5분 동안 신선해 붙을 때 다시 받지 않는다
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: 5 * MINUTE_MS } },
  });
  const renders = { calendar: 0, list: 0 };
  const current: { writes: TodoWrites | null } = { writes: null };

  function WritesProbe({ onRender }: { onRender: (writes: TodoWrites) => void }) {
    onRender(useTodoWrites());
    return null;
  }

  await renderScreen(
    <>
      <Profiler id="calendar" onRender={() => (renders.calendar += 1)}>
        <CalendarProbe />
      </Profiler>
      <Profiler id="list" onRender={() => (renders.list += 1)}>
        <ListProbe />
      </Profiler>
      <DetailProbe />
      <WatchedQueries />
      <WritesProbe
        onRender={(writes) => {
          current.writes = writes;
        }}
      />
    </>,
    { di: createTestDi({ ports: { httpClient, queryClient } }), withLocalDate: true },
  );
  await act(deliverQueryNotifications);

  const names = new Map(Object.entries(WATCHED).map(([name, key]) => [hashKey(key), name]));
  const refetched: string[] = [];
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'fetch') {
      refetched.push(names.get(event.query.queryHash) ?? event.query.queryHash);
    }
  });
  renders.calendar = 0;
  renders.list = 0;

  const writes = () => {
    if (current.writes == null) {
      throw new Error('WritesProbe가 렌더되지 않았다');
    }
    return current.writes;
  };
  /** 누른 직후(낙관적 값) → 서버 응답 → 다시 받은 응답을 단계별로 흘린다 */
  async function tap(start: (writes: TodoWrites) => Promise<unknown>) {
    await act(async () => {
      start(writes()).catch(noop);
      await deliverQueryNotifications();
    });
  }
  async function settleWrites() {
    await act(async () => {
      heldWrites.splice(0).forEach((settle) => settle());
      await deliverQueryNotifications();
    });
  }
  /** 보낸 순서와 다르게 응답이 오게 몇 번째 쓰기만 돌려준다 */
  async function settleWrite(index: number) {
    await act(async () => {
      heldWrites[index]?.();
      await deliverQueryNotifications();
    });
  }
  function failNextWrite() {
    failing.next = true;
  }
  const listTodo = (todoId: number) =>
    queryClient
      .getQueryData(TODO_QUERY_KEYS.listByDate({ date: DAY }))
      ?.todos.find((todo) => todo.id === todoId);
  const calendarDay = () =>
    queryClient
      .getQueryData(TODO_QUERY_KEYS.completionsByRange(MONTH))
      ?.completions.find((completion) => completion.date === DAY);
  const detailTodo = () => queryClient.getQueryData(TODO_QUERY_KEYS.detail({ todoId: 1 }))?.todo;

  return {
    server,
    queryClient,
    renders,
    refetched: () => [...new Set(refetched)].sort(),
    tap,
    settleWrites,
    settleWrite,
    failNextWrite,
    listTodo,
    calendarDay,
    detailTodo,
  };
}

describe('할 일 쓰기 뒤 다시 받는 조회', () => {
  it.each<{ path: string; start: (writes: TodoWrites) => Promise<unknown>; expected: string[] }>([
    {
      path: '할 일 체크',
      start: (w) => w.toggleTodo.mutateAsync({ todoId: 1, body: { completed: true }, date: DAY }),
      expected: ['widget:day'],
    },
    {
      path: '할 일 체크 풀기',
      start: (w) => w.toggleTodo.mutateAsync({ todoId: 3, body: { completed: false }, date: DAY }),
      expected: ['overview', 'widget:day'],
    },
    {
      path: '할 일 만들기',
      start: (w) =>
        w.createTodo.mutateAsync({
          values: createTodoFormValues({ title: '새 할 일', startDate: DAY }),
        }),
      expected: ['widget:day'],
    },
    {
      path: '할 일 지우기',
      start: (w) => w.deleteTodo.mutateAsync({ todoId: 2, date: DAY }),
      expected: ['overview', 'widget:day'],
    },
    {
      path: '할 일 순서 바꾸기',
      start: (w) =>
        w.reorderTodo.mutateAsync({ id: 2, input: { targetTodoId: 1, position: 'before' } }),
      expected: ['list:day', 'widget:day'],
    },
    {
      path: '제목 고치기',
      start: (w) => w.updateTodo.mutateAsync({ todoId: 1, input: { title: '새 제목' } }),
      expected: ['list:day', 'widget:day'],
    },
    {
      path: '날짜 옮기기',
      start: (w) =>
        w.updateTodo.mutateAsync({ todoId: 1, input: { startDate: MOVED_DAY, endDate: null } }),
      expected: ['calendar:month', 'calendar:next-month', 'list:day', 'widget:day'],
    },
    {
      path: '시각 바꾸기',
      start: (w) =>
        w.updateSchedule.mutateAsync({
          todoId: 1,
          changedField: 'time',
          input: { startDate: DAY, endDate: null, scheduledTime: '10:00', isAllDay: false },
        }),
      expected: ['list:day', 'widget:day'],
    },
    {
      path: '카테고리 바꾸기',
      start: (w) => w.changeCategory.mutateAsync({ todoId: 1, input: { categoryId: 2 } }),
      expected: ['calendar:month', 'categories', 'list:day', 'widget:day'],
    },
    {
      path: '미완료 할 일에 하위 항목 더하기',
      start: (w) => w.addSubTodo.mutateAsync({ todoId: 1, title: '새 항목', date: DAY }),
      expected: [],
    },
    {
      path: '끝낸 할 일에 하위 항목 더하기',
      start: (w) => w.addSubTodo.mutateAsync({ todoId: 3, title: '새 항목', date: DAY }),
      expected: ['overview', 'widget:day'],
    },
    {
      path: '하위 항목 체크',
      start: (w) =>
        w.toggleSubTodo.mutateAsync({ todoId: 1, subTodoId: 11, isCompleted: true, date: DAY }),
      expected: [],
    },
    {
      path: '하위 항목 제목 고치기',
      start: (w) =>
        w.updateSubTodo.mutateAsync({ todoId: 1, subTodoId: 11, title: '바꾼 항목', date: DAY }),
      expected: [],
    },
    {
      path: '하위 항목 지우기',
      start: (w) => w.deleteSubTodo.mutateAsync({ todoId: 1, subTodoId: 12, date: DAY }),
      expected: [],
    },
    {
      path: '하위 항목 순서 바꾸기',
      start: (w) => w.reorderSubTodos.mutateAsync({ todoId: 1, subTodoIds: [12, 11], date: DAY }),
      expected: [],
    },
  ])(
    '$path: 바뀐 조회만 다시 받고 다른 날짜·친구·안 바뀐 카테고리는 그대로 둔다',
    async ({ start, expected }) => {
      // Given
      const { refetched, tap, settleWrites } = await renderFeed();

      // When
      await tap(start);
      await settleWrites();

      // Then
      expect(refetched()).toEqual(expected);
    },
  );
});

describe('할 일 쓰기의 낙관적 값과 렌더', () => {
  it('체크하면 행·상세·달력 점이 바로 바뀌고 달력은 한 번만 그린다', async () => {
    // Given
    const { renders, tap, settleWrites, listTodo, calendarDay, detailTodo } = await renderFeed();

    // When
    await tap((w) => w.toggleTodo.mutateAsync({ todoId: 1, body: { completed: true }, date: DAY }));

    // Then
    expect(listTodo(1)?.completed).toBe(true);
    expect(detailTodo()?.completed).toBe(true);
    expect(calendarDay()?.completedTodos).toBe(2);

    // When
    await settleWrites();

    // Then
    expect(renders.calendar).toBe(1);
  });

  it('하위 항목을 체크하면 행과 상세의 "2/2"가 바로 맞고 달력은 다시 그리지 않는다', async () => {
    // Given
    const { renders, tap, settleWrites, listTodo, detailTodo, server } = await renderFeed();

    // When
    await tap((w) =>
      w.toggleSubTodo.mutateAsync({ todoId: 1, subTodoId: 11, isCompleted: true, date: DAY }),
    );
    const optimistic = {
      row: SubTodoPolicy.getSubTodoStats(listTodo(1)?.subTodos ?? []),
      detail: SubTodoPolicy.getSubTodoStats(detailTodo()?.subTodos ?? []),
    };
    await settleWrites();

    // Then
    expect(optimistic).toEqual({
      row: { total: 2, completed: 2 },
      detail: { total: 2, completed: 2 },
    });
    expect(SubTodoPolicy.getSubTodoStats(listTodo(1)?.subTodos ?? [])).toEqual(
      server.find(1)?.itemStats,
    );
    expect(renders).toEqual({ calendar: 0, list: 1 });
  });

  it('끝낸 할 일에 항목을 더하면 행의 완료가 풀리고 달력 점이 바로 줄어든다', async () => {
    // Given
    const { tap, settleWrites, listTodo, calendarDay, server } = await renderFeed();

    // When
    await tap((w) => w.addSubTodo.mutateAsync({ todoId: 3, title: '새 항목', date: DAY }));

    // Then
    expect(listTodo(3)?.completed).toBe(false);
    expect(calendarDay()?.completedTodos).toBe(0);

    // When
    await settleWrites();

    // Then
    expect(listTodo(3)?.completed).toBe(server.find(3)?.completed);
    expect(listTodo(3)?.subTodos.every((subTodo) => subTodo.id > 0)).toBe(true);
  });
});

describe('할 일 쓰기의 되돌리기와 겹친 쓰기', () => {
  it('체크가 실패하면 행·상세·달력 점이 모두 돌아오고 서버 값으로 다시 맞춘다', async () => {
    // Given
    const { tap, settleWrites, failNextWrite, listTodo, calendarDay, detailTodo, refetched } =
      await renderFeed();
    failNextWrite();
    await tap((w) => w.toggleTodo.mutateAsync({ todoId: 1, body: { completed: true }, date: DAY }));

    // When
    await settleWrites();

    // Then
    expect({
      row: listTodo(1)?.completed,
      detail: detailTodo()?.completed,
      calendar: calendarDay()?.completedTodos,
    }).toEqual({ row: false, detail: false, calendar: 1 });
    expect(refetched()).toEqual(['calendar:month', 'detail:1', 'list:day', 'widget:day']);
  });

  it('하위 항목 체크가 실패하면 행과 상세의 진행 숫자가 함께 돌아온다', async () => {
    // Given
    const { tap, settleWrites, failNextWrite, listTodo, detailTodo } = await renderFeed();
    failNextWrite();
    await tap((w) =>
      w.toggleSubTodo.mutateAsync({ todoId: 1, subTodoId: 11, isCompleted: true, date: DAY }),
    );

    // When
    await settleWrites();

    // Then
    expect({
      row: SubTodoPolicy.getSubTodoStats(listTodo(1)?.subTodos ?? []),
      detail: SubTodoPolicy.getSubTodoStats(detailTodo()?.subTodos ?? []),
    }).toEqual({ row: { total: 2, completed: 1 }, detail: { total: 2, completed: 1 } });
  });

  it('같은 항목을 연달아 눌러 응답이 거꾸로 와도 마지막에 서버 값으로 맞춘다', async () => {
    // Given
    const { tap, settleWrite, listTodo, server } = await renderFeed();
    await tap((w) =>
      w.toggleSubTodo.mutateAsync({ todoId: 1, subTodoId: 11, isCompleted: true, date: DAY }),
    );
    await tap((w) =>
      w.toggleSubTodo.mutateAsync({ todoId: 1, subTodoId: 11, isCompleted: false, date: DAY }),
    );

    // When
    await settleWrite(1);
    const whileFirstPending = listTodo(1)?.subTodos.find((subTodo) => subTodo.id === 11);
    await settleWrite(0);

    // Then
    expect(whileFirstPending?.completed).toBe(false);
    expect(listTodo(1)?.subTodos.find((subTodo) => subTodo.id === 11)?.completed).toBe(
      server.find(1)?.items.find((each) => each.id === 11)?.completed,
    );
  });

  it('체크를 기다리는 동안 제목 저장이 끝나도 목록을 다시 받지 않아 체크가 되돌아가지 않는다', async () => {
    // Given
    const { tap, settleWrite, listTodo, refetched } = await renderFeed();
    await tap((w) => w.toggleTodo.mutateAsync({ todoId: 2, body: { completed: true }, date: DAY }));
    await tap((w) => w.updateTodo.mutateAsync({ todoId: 1, input: { title: '새 제목' } }));

    // When
    await settleWrite(1);

    // Then
    expect(listTodo(2)?.completed).toBe(true);
    expect(refetched()).toEqual([]);

    // When
    await settleWrite(0);

    // Then
    expect(listTodo(1)?.title).toBe('새 제목');
    expect(listTodo(2)?.completed).toBe(true);
  });
});

const WEEK = { startDate: createDateKey('2026-03-02'), endDate: createDateKey('2026-03-08') };
const BLUE = '#3B82F6';
const RED = '#EF4444';
const EXISTING = createTodoDto({
  id: 1,
  startDate: DAY,
  category: { id: 2, name: '업무', color: RED, sortOrder: 1 },
});
const CREATED = createTodoDto({ id: 501, title: '새 할 일', startDate: DAY, sortOrder: 1 });
const VALUES = createTodoFormValues({ title: '새 할 일', startDate: DAY });

function completionsDto(range: { startDate: string; endDate: string }, hasCreated: boolean) {
  return createDailyCompletionsDto({
    completions: [
      {
        date: DAY,
        totalTodos: hasCreated ? 2 : 1,
        completedTodos: 0,
        isComplete: false,
        completionRate: 0,
        // 서버는 GROUP BY 순서로 색을 모아 목록 순서와 다를 수 있다
        categoryColors: hasCreated ? [BLUE, RED] : [RED],
      },
    ],
    totalCompleteDays: 0,
    dateRange: range,
  });
}

function respondAsServer(
  url: string,
  params: Record<string, unknown> | undefined,
  hasCreated: boolean,
) {
  if (url === 'v1/todo-categories') {
    return ok(createTodoCategoryListDto());
  }
  if (url === 'v1/daily-completions') {
    return ok(completionsDto(params?.startDate === WEEK.startDate ? WEEK : MONTH, hasCreated));
  }
  if (url === 'v1/todos/overview') {
    return ok({ hasTodo: true, hasCompletedTodo: false, hasActiveRepeat: false });
  }
  if (url === 'v1/todos/summary') {
    return ok({
      date: DAY,
      totalTodos: hasCreated ? 2 : 1,
      completedTodos: 0,
      completionRate: 0,
      isComplete: false,
      currentStreak: 0,
      topTodos: [],
    });
  }
  return ok(createTodoListResponseDto({ items: hasCreated ? [EXISTING, CREATED] : [EXISTING] }));
}

function FeedCalendarProbe() {
  // MyCalendar처럼 data와 isError만 읽는다
  const query = useQuery(useGetDailyCompletionsQueryOptions(MONTH));
  return query.isError || query.data == null ? null : null;
}

function FeedListProbe() {
  // TodoList처럼 목록·카테고리 data와 dataUpdatedAt을 읽는다
  const categories = useQuery(useGetTodoCategoriesQueryOptions());
  const list = useQuery(useGetTodosByDateQueryOptions({ date: DAY }));
  return categories.data == null || list.data == null || list.dataUpdatedAt < 0 ? null : null;
}

function BackgroundProbe() {
  // 위젯 동기화·시작 체크리스트가 피드 뒤에서 붙들고 있는 조회
  useQuery(useGetTodoSummaryQueryOptions({ date: DAY }));
  useQuery(useGetDailyCompletionsQueryOptions(WEEK));
  useQuery(useGetTodoOverviewQueryOptions());
  return null;
}

type CreateTodo = ReturnType<typeof useCreateTodo>['mutateAsync'];

function useCreateTodo() {
  return useMutation(useCreateTodoMutationOptions());
}

async function renderCreateFeed() {
  const httpClient = createHttpClientStub();
  const server = { hasCreated: false };
  const heldGets: Array<() => void> = [];
  httpClient.get.mockImplementation(async (url, options) => {
    const response = respondAsServer(url, options?.params, server.hasCreated);
    if (!server.hasCreated) {
      return response;
    }
    // 만든 뒤 다시 받는 응답은 붙잡아 두었다가 따로 돌려 렌더를 단계별로 센다
    const pending = createPendingResponse(response);
    heldGets.push(pending.settle);
    return pending.response;
  });
  const created = createPendingResponse<Result<unknown, ApiError>>(
    ok({ message: 'ok', todo: CREATED }),
  );
  const failed = createPendingResponse<Result<unknown, ApiError>>(err(createTodoApiError()));
  let createResponse = created;
  httpClient.post.mockImplementation(() => {
    server.hasCreated = createResponse === created;
    return createResponse.response;
  });
  // 운영처럼 5분 동안 신선해 붙을 때 다시 받지 않는다
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: 5 * MINUTE_MS } },
  });
  const renders = { calendar: 0, list: 0 };
  const mutation: { createTodo: CreateTodo | null } = { createTodo: null };

  function MutationProbe({ onRender }: { onRender: (createTodo: CreateTodo) => void }) {
    onRender(useCreateTodo().mutateAsync);
    return null;
  }

  await renderScreen(
    <>
      <Profiler id="calendar" onRender={() => (renders.calendar += 1)}>
        <FeedCalendarProbe />
      </Profiler>
      <Profiler id="list" onRender={() => (renders.list += 1)}>
        <FeedListProbe />
      </Profiler>
      <BackgroundProbe />
      <MutationProbe
        onRender={(createTodo) => {
          mutation.createTodo = createTodo;
        }}
      />
    </>,
    { di: createTestDi({ ports: { httpClient, queryClient } }), withLocalDate: true },
  );
  await act(deliverQueryNotifications);

  const refetched: string[] = [];
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'fetch') {
      refetched.push(event.query.queryHash);
    }
  });
  renders.calendar = 0;
  renders.list = 0;
  httpClient.get.mockClear();

  /** 사용자가 저장을 누르고 → 서버가 답하고 → 다시 받은 응답이 오는 세 단계를 따로 그린다 */
  async function addTodo() {
    await act(async () => {
      mutation.createTodo?.({ values: VALUES }).catch(noop);
      await deliverQueryNotifications();
    });
    await act(async () => {
      createResponse.settle();
      await deliverQueryNotifications();
    });
    await act(async () => {
      heldGets.splice(0).forEach((settle) => settle());
      await deliverQueryNotifications();
    });
  }

  function failCreate() {
    createResponse = failed;
  }

  return { httpClient, queryClient, renders, refetched, addTodo, failCreate };
}

describe('할 일을 만든 뒤 다시 받는 조회', () => {
  it('하루짜리를 만들면 서버만 아는 위젯 요약만 다시 받고 달력은 낙관적 반영 한 번만 그린다', async () => {
    // Given
    const { httpClient, renders, refetched, addTodo } = await renderCreateFeed();

    // When
    await addTodo();

    // Then
    expect(refetched).toEqual([
      hashKey(TODO_QUERY_KEYS.widgetSummaryByDate({ date: DAY, userId: null })),
    ]);
    expect(httpClient.get).toHaveBeenCalledTimes(1);
    expect(renders).toEqual({ calendar: 1, list: 2 });
  });

  it('만들기가 실패하면 고친 날짜 목록과 그날 달력 범위를 서버 값으로 다시 맞춘다', async () => {
    // Given
    const { queryClient, refetched, addTodo, failCreate } = await renderCreateFeed();
    failCreate();

    // When
    await addTodo();

    // Then
    expect(refetched).toEqual(
      expect.arrayContaining([
        hashKey(TODO_QUERY_KEYS.listByDate({ date: DAY })),
        hashKey(TODO_QUERY_KEYS.completionsByRange(MONTH)),
        hashKey(TODO_QUERY_KEYS.completionsByRange(WEEK)),
      ]),
    );
    expect(queryClient.getQueryData(TODO_QUERY_KEYS.listByDate({ date: DAY }))?.todos).toHaveLength(
      1,
    );
  });
});
