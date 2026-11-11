import { TODO_CATEGORY_QUERY_KEYS } from '@src/features/planning/category/constants/todo-category-query-keys';
import { createPendingResponse, createTestQueryClient } from '@src/shared/__tests__';
import { QueryObserver, type QueryClient } from '@tanstack/react-query';
import { noop } from 'es-toolkit';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { TODO_MUTATION_KEYS } from '../constants/todo-mutation-keys';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import type { DailyCompletionsResult } from '../domains/daily-completion.model';
import type { Todo, TodoListResult, TodoSummary } from '../domains/todo.model';
import {
  getCachedTodoDateSpan,
  invalidateFeedTodos,
  invalidateTodoDependentQueries,
  invalidateTodos,
  invalidateTodoSummaries,
  settleTodoWrite,
  syncDailyCompletionWithList,
  withTodoAdded,
  withTodoCompleted,
  withTodoCreated,
  withTodoRemoved,
  withTodoRestored,
  withTodoSaved,
  withTodoUpdated,
} from './todo-cache';

const DAY = '2026-07-14';
const NEXT_DAY = '2026-07-15';
const WEEK = { startDate: '2026-07-13', endDate: '2026-07-19' };
const NEXT_WEEK = { startDate: '2026-07-20', endDate: '2026-07-26' };

const toList = (todos: Todo[]): TodoListResult => ({ todos, hasNext: false, nextCursor: null });
const toCompletions = (range: typeof WEEK): DailyCompletionsResult => ({
  completions: [],
  totalCompleteDays: 0,
  dateRange: range,
});
const toSummary = (date: string): TodoSummary => ({
  date,
  totalTodos: 0,
  completedTodos: 0,
  completionRate: 0,
  isComplete: false,
  currentStreak: 0,
  topTodos: [],
});

function isInvalidated(client: QueryClient, queryKey: readonly unknown[]) {
  return client.getQueryState(queryKey)?.isInvalidated === true;
}

describe('목록 updater', () => {
  const first = createParentTodo({ id: 1 });
  const second = createParentTodo({ id: 2 });

  it('더하면 끝에 붙고 원래 목록은 바뀌지 않는다', () => {
    // Given
    const list = toList([first]);

    // When
    const next = withTodoAdded(list, second);

    // Then
    expect(next.todos.map((todo) => todo.id)).toEqual([1, 2]);
    expect(list.todos).toHaveLength(1);
  });

  it('지우거나 고치면 그 할 일만 바뀐다', () => {
    // Given
    const list = toList([first, second]);

    // When
    const removed = withTodoRemoved(list, 1);
    const updated = withTodoUpdated(list, 2, (todo) => ({ ...todo, completed: true }));

    // Then
    expect(removed.todos).toEqual([second]);
    expect(updated.todos[0]).toBe(first);
    expect(updated.todos[1]?.completed).toBe(true);
  });

  it('되돌리면 빠진 할 일은 원래 자리로, 남은 할 일은 값만 돌아온다', () => {
    // Given
    const list = toList([second]);
    const changed = toList([{ ...first, completed: true }, second]);

    // When
    const reinserted = withTodoRestored(list, { todo: first, index: 0 });
    const reverted = withTodoRestored(changed, { todo: first, index: 0 });

    // Then
    expect(reinserted.todos).toEqual([first, second]);
    expect(reverted.todos).toEqual([first, second]);
  });

  it.each([
    {
      title: '만들기 응답은 임시 행을 서버 행으로 바꾼다',
      todos: [first, createParentTodo({ id: -7 })],
      expectedIds: [1, 2],
    },
    {
      title: '응답 전에 다시 받아 임시 행이 사라졌으면 서버 행을 끝에 붙인다',
      todos: [first],
      expectedIds: [1, 2],
    },
    {
      title: '다시 받은 목록에 이미 서버 행이 있으면 한 번만 둔다',
      todos: [first, second],
      expectedIds: [1, 2],
    },
  ])('$title', ({ todos, expectedIds }) => {
    // Given
    const list = toList(todos);

    // When
    const next = withTodoSaved(list, -7, second);

    // Then
    expect(next.todos.map((todo) => todo.id)).toEqual(expectedIds);
    expect(next.todos.at(-1)).toBe(second);
  });

  it('존재 여부는 이미 참이면 같은 객체를 돌려 구독자가 다시 그리지 않는다', () => {
    // Given
    const existence = { hasTodo: true, hasCompletedTodo: false };

    // When
    const created = withTodoCreated(existence);
    const completed = withTodoCompleted(existence);

    // Then
    expect(created).toBe(existence);
    expect(completed).toEqual({ hasTodo: true, hasCompletedTodo: true });
  });
});

describe('캐시에서 할 일 찾기', () => {
  it('알림으로 연 상세처럼 그날 목록이 없으면 상세의 여러 날 기간으로 달력 범위를 고른다', () => {
    // Given
    const queryClient = createTestQueryClient();
    const multiDay = createParentTodo({ id: 7, startDate: DAY, endDate: '2026-07-22' });
    queryClient.setQueryData(TODO_QUERY_KEYS.detail({ todoId: 7 }), {
      todo: multiDay,
      owner: { id: 'u', name: null, profileImage: null },
      permissions: { canEdit: true, canComment: true, canNudge: false },
      metrics: { viewCount: 0, commentCount: 0 },
    });

    // When
    const span = getCachedTodoDateSpan(queryClient, { date: NEXT_DAY, todoId: 7 });

    // Then
    expect(span).toEqual({ startDate: DAY, endDate: '2026-07-22' });
  });

  it('어디에도 없으면 보고 있는 하루로 본다', () => {
    // Given
    const queryClient = createTestQueryClient();

    // When
    const span = getCachedTodoDateSpan(queryClient, { date: NEXT_DAY, todoId: 7 });

    // Then
    expect(span).toEqual({ startDate: NEXT_DAY, endDate: NEXT_DAY });
  });
});

describe('할 일 쓰기 정리', () => {
  function createSeededClient() {
    const client = createTestQueryClient();
    client.setQueryData(TODO_QUERY_KEYS.listByDate({ date: DAY }), toList([]));
    client.setQueryData(TODO_QUERY_KEYS.listByDate({ date: NEXT_DAY }), toList([]));
    client.setQueryData(TODO_QUERY_KEYS.completionsByRange(WEEK), toCompletions(WEEK));
    client.setQueryData(TODO_QUERY_KEYS.completionsByRange(NEXT_WEEK), toCompletions(NEXT_WEEK));
    client.setQueryData(TODO_QUERY_KEYS.widgetSummaryByDate({ date: DAY }), toSummary(DAY));
    client.setQueryData(
      TODO_QUERY_KEYS.widgetSummaryByDate({ date: NEXT_DAY }),
      toSummary(NEXT_DAY),
    );
    return client;
  }

  it('하루짜리를 다 불러온 목록에서 고쳤으면 그 목록·달력은 그대로 두고 그날 위젯 요약만 낡음으로 표시한다', async () => {
    // Given
    const client = createSeededClient();

    // When
    await settleTodoWrite(client, {
      date: DAY,
      todoId: 1,
      span: { startDate: DAY, endDate: DAY },
      isCompletionAffected: true,
      hasFailed: false,
      ticket: { sequence: Number.MAX_SAFE_INTEGER, startedWithOthers: false },
    });

    // Then
    expect(isInvalidated(client, TODO_QUERY_KEYS.listByDate({ date: DAY }))).toBe(false);
    expect(isInvalidated(client, TODO_QUERY_KEYS.listByDate({ date: NEXT_DAY }))).toBe(false);
    expect(isInvalidated(client, TODO_QUERY_KEYS.completionsByRange(WEEK))).toBe(false);
    expect(isInvalidated(client, TODO_QUERY_KEYS.widgetSummaryByDate({ date: DAY }))).toBe(true);
    expect(isInvalidated(client, TODO_QUERY_KEYS.widgetSummaryByDate({ date: NEXT_DAY }))).toBe(
      false,
    );
  });

  it('여러 날 할 일은 기간 안의 다른 날짜 목록과 겹치는 달력 범위만 낡음으로 표시한다', async () => {
    // Given
    const client = createSeededClient();

    // When
    await settleTodoWrite(client, {
      date: DAY,
      span: { startDate: DAY, endDate: NEXT_DAY },
      isCompletionAffected: true,
      hasFailed: false,
      ticket: { sequence: Number.MAX_SAFE_INTEGER, startedWithOthers: false },
    });

    // Then
    expect(isInvalidated(client, TODO_QUERY_KEYS.listByDate({ date: DAY }))).toBe(false);
    expect(isInvalidated(client, TODO_QUERY_KEYS.listByDate({ date: NEXT_DAY }))).toBe(true);
    expect(isInvalidated(client, TODO_QUERY_KEYS.completionsByRange(WEEK))).toBe(true);
    expect(isInvalidated(client, TODO_QUERY_KEYS.completionsByRange(NEXT_WEEK))).toBe(false);
  });

  it('실패하면 고친 목록·상세·그날 달력까지 서버 값으로 다시 맞춘다', async () => {
    // Given
    const client = createSeededClient();
    const detailKey = TODO_QUERY_KEYS.detail({ todoId: 1 });
    client.getQueryCache().build(client, { queryKey: detailKey });

    // When
    await settleTodoWrite(client, {
      date: DAY,
      todoId: 1,
      span: { startDate: DAY, endDate: DAY },
      isCompletionAffected: true,
      hasFailed: true,
      ticket: { sequence: Number.MAX_SAFE_INTEGER, startedWithOthers: false },
    });

    // Then
    expect(isInvalidated(client, TODO_QUERY_KEYS.listByDate({ date: DAY }))).toBe(true);
    expect(isInvalidated(client, detailKey)).toBe(true);
    expect(isInvalidated(client, TODO_QUERY_KEYS.completionsByRange(WEEK))).toBe(true);
  });

  it('다른 쓰기가 진행 중이면 낡음만 표시하고 화면에 붙은 조회도 다시 받지 않는다', async () => {
    // Given
    const client = createSeededClient();
    const queryFn = jest.fn(async () => toList([]));
    const unsubscribe = new QueryObserver(client, {
      queryKey: TODO_QUERY_KEYS.listByDate({ date: DAY }),
      queryFn,
      staleTime: Infinity,
    }).subscribe(noop);
    const otherWrite = createPendingResponse(undefined);
    const running = client
      .getMutationCache()
      .build(client, {
        mutationKey: TODO_MUTATION_KEYS.listWrites(),
        mutationFn: () => otherWrite.response,
      })
      .execute(undefined);
    // 이 쓰기 자신도 진행 중으로 센다
    const self = createPendingResponse(undefined);
    const selfRunning = client
      .getMutationCache()
      .build(client, {
        mutationKey: TODO_MUTATION_KEYS.listWrites(),
        mutationFn: () => self.response,
      })
      .execute(undefined);

    // When
    await settleTodoWrite(client, {
      date: DAY,
      todoId: 1,
      span: { startDate: DAY, endDate: DAY },
      isCompletionAffected: false,
      hasFailed: true,
      ticket: { sequence: Number.MAX_SAFE_INTEGER, startedWithOthers: false },
    });

    // Then
    expect(isInvalidated(client, TODO_QUERY_KEYS.listByDate({ date: DAY }))).toBe(true);
    expect(queryFn).not.toHaveBeenCalled();
    otherWrite.settle();
    self.settle();
    await Promise.all([running, selfRunning]);
    unsubscribe();
  });
});

describe('바뀐 날짜를 모를 때의 무효화', () => {
  const listKey = TODO_QUERY_KEYS.listByDate({ date: DAY });
  const completionKey = TODO_QUERY_KEYS.completionsByRange(WEEK);
  const friendKey = TODO_QUERY_KEYS.friendListByDate({ userId: 'u', date: DAY });
  const categoryKey = TODO_CATEGORY_QUERY_KEYS.list();

  function createSeededClient() {
    const client = createTestQueryClient();
    client.setQueryData(listKey, toList([createParentTodo({ id: 7 })]));
    client.setQueryData(completionKey, toCompletions(WEEK));
    client.setQueryData(friendKey, toList([]));
    client.setQueryData(categoryKey, { categories: [] });

    return client;
  }

  it('내 할 일과 카테고리를 무효화하고 친구 목록은 건드리지 않는다', async () => {
    // Given
    const client = createSeededClient();

    // When
    await invalidateTodos(client);

    // Then
    expect(isInvalidated(client, listKey)).toBe(true);
    expect(isInvalidated(client, completionKey)).toBe(true);
    expect(isInvalidated(client, categoryKey)).toBe(true);
    expect(isInvalidated(client, friendKey)).toBe(false);
  });

  it('댓글 수가 바뀌면 그 할 일을 보여 주는 목록만 무효화한다', async () => {
    // Given
    const client = createSeededClient();
    const otherListKey = TODO_QUERY_KEYS.listByDate({ date: NEXT_DAY });
    client.setQueryData(otherListKey, toList([createParentTodo({ id: 8 })]));

    // When
    await invalidateTodoSummaries(client, { todoId: 7 });

    // Then
    expect(isInvalidated(client, listKey)).toBe(true);
    expect(isInvalidated(client, otherListKey)).toBe(false);
    expect(isInvalidated(client, friendKey)).toBe(false);
  });

  it('할 일이 바뀌면 refreshOnTodoChange로 밝힌 다른 피처의 조회만 무효화한다', async () => {
    // Given
    const client = createSeededClient();
    const dependentKey = ['other-feature', 'depends-on-todo'];
    const independentKey = ['other-feature', 'independent'];
    client.setQueryData(dependentKey, 1);
    client.setQueryData(independentKey, 1);
    client
      .getQueryCache()
      .find({ queryKey: dependentKey })
      ?.setOptions({
        meta: { refreshOnTodoChange: true },
      });

    // When
    await invalidateTodoDependentQueries(client);

    // Then
    expect(isInvalidated(client, dependentKey)).toBe(true);
    expect(isInvalidated(client, independentKey)).toBe(false);
    expect(isInvalidated(client, listKey)).toBe(false);
  });

  it('피드를 새로 고치면 목록과 완료 통계만 무효화한다', async () => {
    // Given
    const client = createSeededClient();

    // When
    await invalidateFeedTodos(client);

    // Then
    expect(isInvalidated(client, listKey)).toBe(true);
    expect(isInvalidated(client, completionKey)).toBe(true);
    expect(isInvalidated(client, friendKey)).toBe(false);
    expect(isInvalidated(client, categoryKey)).toBe(false);
  });
});

describe('달력 요약 맞추기', () => {
  it('그날을 담은 범위만 고치고 같은 접두사의 위젯 요약·존재 여부 캐시는 건드리지 않는다', () => {
    // Given
    const client = createTestQueryClient();
    const widgetKey = TODO_QUERY_KEYS.widgetSummaryByDate({ date: DAY, userId: 'u' });
    const widgetSummary = toSummary(DAY);
    const existence = { hasTodo: true, hasCompletedTodo: false };
    const nextWeek = toCompletions(NEXT_WEEK);
    client.setQueryData(widgetKey, widgetSummary);
    client.setQueryData(TODO_QUERY_KEYS.existence(), existence);
    client.setQueryData(TODO_QUERY_KEYS.listByDate({ date: DAY }), toList([]));
    client.setQueryData(TODO_QUERY_KEYS.completionsByRange(NEXT_WEEK), nextWeek);
    client.setQueryData(TODO_QUERY_KEYS.completionsByRange(WEEK), {
      ...toCompletions(WEEK),
      completions: [
        {
          date: DAY,
          totalTodos: 1,
          completedTodos: 0,
          isComplete: false,
          completionRate: 0,
          categoryColors: [],
        },
      ],
    });

    // When
    syncDailyCompletionWithList(client, { date: DAY });

    // Then
    expect(client.getQueryData(widgetKey)).toBe(widgetSummary);
    expect(client.getQueryData(TODO_QUERY_KEYS.existence())).toBe(existence);
    expect(client.getQueryData(TODO_QUERY_KEYS.completionsByRange(NEXT_WEEK))).toBe(nextWeek);
    expect(client.getQueryData(TODO_QUERY_KEYS.completionsByRange(WEEK))?.completions).toEqual([]);
  });
});
