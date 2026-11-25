import { TODO_PAGE_SIZE } from '@aido/api/vocabulary';
import { useTodoApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { readLocalDateState } from '@src/shared/date/clock';
import { addDaysToDateKey, type DateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { queryOptions, usePrefetchQuery } from '@tanstack/react-query';
import { keyBy, orderBy, take } from 'es-toolkit';

import type { TodoApi } from '../apis/todo.api';
import { UPCOMING_TODO_WINDOW_DAYS } from '../constants/todo.constants';
import {
  type DailyCompletionRange,
  type DailyCompletionsResult,
  type DailyCompletionSummary,
  getCompletionMonthRange,
  getCompletionMonthsCovering,
} from '../domains/daily-completion.model';
import {
  type TodoCategoryGroup,
  TodoListPolicy,
  type TodoListResult,
} from '../domains/todo-list.model';
import type { TodoOverview } from '../domains/todo-overview.model';
import type { Todo } from '../domains/todo.model';
import {
  getTodoSummaryRefetchInterval,
  isTodoSummaryDateRequestable,
  shouldPersistTodosByDate,
} from './todo-cache';
import { TODO_QUERY_KEYS } from './todo-query-keys';

export function useGetTodosByDateQueryOptions({ date }: { date: DateKey }) {
  const todoApi = useTodoApi();
  const todayKey = useTodayKey();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.listByDate({ date }),
    queryFn: async ({ signal }) =>
      unwrap(
        await todoApi.getTodos(
          { startDate: date, endDate: date, size: TODO_PAGE_SIZE.MAX },
          signal,
        ),
      ),
    ...(shouldPersistTodosByDate({ date, todayKey }) && PERSISTED_QUERY_OPTIONS),
  });
}

/** 날짜 key로 찾는 완료 기록. 달력 칸이 자기 날짜로 읽는다 */
export type CompletionsByDate = Record<string, DailyCompletionSummary>;

function selectCompletionsByDate(data: DailyCompletionsResult): CompletionsByDate {
  return keyBy(data.completions, (completion) => completion.date);
}

/** 달 칸들의 결과에서 그 기간의 날만 날짜 순으로 고른다. 한 달이라도 아직 없으면 없음이다 */
function selectCompletionsInRange(
  months: readonly { data: DailyCompletionsResult | undefined }[],
  range: DailyCompletionRange,
): CompletionsByDate | undefined {
  const completions: DailyCompletionSummary[] = [];
  for (const { data } of months) {
    if (data == null) {
      return undefined;
    }
    completions.push(...data.completions);
  }
  // 두 달 칸이 겹치는 날은 같은 서버 값이라 어느 쪽을 남겨도 같다
  const inRange = completions.filter(
    ({ date }) => range.startDate <= date && date <= range.endDate,
  );
  return keyBy(
    orderBy(inRange, [(completion) => completion.date], ['asc']),
    (completion) => completion.date,
  );
}

/** 고른 달과 앞뒤 달의 결과를 한 달력으로 합친다. 겹치는 앞뒤 주는 고른 달의 결과로 그린다 */
export function mergeCalendarCompletions({
  selected,
  previous,
  next,
}: Record<'selected' | 'previous' | 'next', CompletionsByDate | undefined>): CompletionsByDate {
  return { ...previous, ...next, ...selected };
}

function dailyCompletionsQueryOptions(todoApi: TodoApi, month: DateKey) {
  const { startDate, endDate } = getCompletionMonthRange(month);
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.completionsByMonth({ month }),
    queryFn: async ({ signal }) =>
      unwrap(await todoApi.getDailyCompletions(startDate, endDate, signal)),
    ...PERSISTED_QUERY_OPTIONS,
  });
}

/** 한 달 칸의 완료 기록. 달마다 같은 키로 받아 달 안에서 날짜를 옮겨도 다시 묻지 않는다 */
export function useGetDailyCompletionsQueryOptions({ month }: { month: DateKey }) {
  const todoApi = useTodoApi();

  return queryOptions({
    ...dailyCompletionsQueryOptions(todoApi, month),
    select: selectCompletionsByDate,
  });
}

/**
 * 주·10일 같은 기간의 완료 기록. 그 기간을 덮는 달 키를 달력과 함께 쓰고(두 달에 걸치면 두 달)
 * 기간 밖의 날은 `combine`으로 자른다. `useQueries`·`useSuspenseQueries`에 넘긴다
 */
export function useGetDailyCompletionsInRangeQueriesOptions(range: DailyCompletionRange) {
  const todoApi = useTodoApi();

  return {
    queries: getCompletionMonthsCovering(range).map((month) =>
      dailyCompletionsQueryOptions(todoApi, month),
    ),
    combine: (months: readonly { data: DailyCompletionsResult | undefined }[]) =>
      selectCompletionsInRange(months, range),
  };
}

/** 그 기간을 덮는 달 키를 미리 받는다. 덮는 달은 하나나 둘이라 첫 달과 끝 달을 넘기고, 한 달이면 같은 키라 한 번만 받는다 */
export function usePrefetchDailyCompletionsInRange(range: DailyCompletionRange) {
  const todoApi = useTodoApi();
  const [firstMonth, ...restMonths] = getCompletionMonthsCovering(range);

  usePrefetchQuery(dailyCompletionsQueryOptions(todoApi, firstMonth));
  usePrefetchQuery(dailyCompletionsQueryOptions(todoApi, restMonths.at(-1) ?? firstMonth));
}

export function useGetFriendDailyCompletionsQueryOptions({
  friendUserId,
  startDate,
  endDate,
}: DailyCompletionRange & { friendUserId: string }) {
  const todoApi = useTodoApi();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.friendCompletionsByRange({
      userId: friendUserId,
      startDate,
      endDate,
    }),
    queryFn: async ({ signal }) =>
      unwrap(await todoApi.getFriendDailyCompletions(friendUserId, startDate, endDate, signal)),
    select: selectCompletionsByDate,
  });
}

/** 친구의 그날 할 일을 할 일이 가진 카테고리로 묶는다 */
export function selectTodoCategoryGroups(
  list: TodoListResult,
): TodoCategoryGroup<Todo['category']>[] {
  return TodoListPolicy.groupByCategory(list);
}

export function useGetFriendTodosQueryOptions({
  friendUserId,
  date,
}: {
  friendUserId: string;
  date: DateKey;
}) {
  const todoApi = useTodoApi();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.friendListByDate({ userId: friendUserId, date }),
    queryFn: async ({ signal }) =>
      unwrap(
        await todoApi.getFriendTodos(
          friendUserId,
          { startDate: date, endDate: date, size: TODO_PAGE_SIZE.MAX },
          signal,
        ),
      ),
  });
}

function todoDetailsQueryOptions(todoApi: TodoApi, todoId: number) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.detail({ todoId }),
    queryFn: async ({ signal }) => unwrap(await todoApi.getTodoDetails(todoId, signal)),
    // 차단한 사람의 할 일을 보던 상세는 다시 받아 볼 수 없음 안내로 바뀐다
    meta: { refreshOnBlockChange: true },
  });
}

export function useGetTodoDetailsQueryOptions({ todoId }: { todoId: number }) {
  return todoDetailsQueryOptions(useTodoApi(), todoId);
}

/** 할 일이 누를 때 정해지는 곳(알림 버튼)의 상세 조회 옵션. 화면의 상세 조회와 같은 옵션이다 */
export function useGetTodoDetailsQueryOptionsFactory() {
  const todoApi = useTodoApi();
  return (todoId: number) => todoDetailsQueryOptions(todoApi, todoId);
}

/** 진행 중인 반복이 있는지만 고른다. 다른 칸이 바뀌어도 반복 안내는 다시 그리지 않는다 */
export function selectHasActiveRepeat(overview: TodoOverview): boolean {
  return overview.hasActiveRepeat;
}

/** 반복 안내·시작 체크리스트가 각자 select로 고른다. 둘 다 화면 한쪽의 보조 정보라 실패해도 경계로 보내지 않고 그 안내만 뺀다 */
export function useGetTodoOverviewQueryOptions() {
  const todoApi = useTodoApi();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.overview(),
    queryFn: async ({ signal }) => unwrap(await todoApi.getTodoOverview(signal)),
    throwOnError: false,
  });
}

/** 넣을 곳 여러 곳을 한 번에 읽는 곳(useSuspenseQueries)의 한도 조회 옵션. categoryId null은 아직 없는 새 카테고리다 */
export function useGetTodoResourceLimitQueryOptionsFactory() {
  const todoApi = useTodoApi();
  return ({ categoryId }: { categoryId: number | null }) =>
    queryOptions({
      queryKey: TODO_QUERY_KEYS.resourceLimit({ categoryId }),
      queryFn: async ({ signal }) => unwrap(await todoApi.getResourceLimit({ categoryId }, signal)),
      // 할 일 하나를 쓸 때마다 무효화하지 않는 대신 넣을 곳을 볼 때마다 서버 수로 다시 맞춘다
      staleTime: 0,
    });
}

interface TodoSummaryQueryInput {
  date: DateKey;
  userId: string | null;
  /** 상위 할 일을 이만큼만 고른다. 없으면 서버가 준 만큼이다 */
  limit?: number;
}

/** 홈 위젯(오늘·내일)용. 자정 직후 기기·서버 날짜가 어긋나면 foreground를 기다리지 않고 5s→10s→20s→40s로 다시 묻는다 */
export function useGetTodoSummaryQueryOptions({ date, userId, limit }: TodoSummaryQueryInput) {
  const todoApi = useTodoApi();

  // 복귀·자정 직후 재조회는 날짜 state가 바뀌기 전에 돌 수 있어, 요청 헤더와 같은 기기 시계·시간대로 묻는 순간 다시 잰다
  const isRequestable = () =>
    userId != null &&
    isTodoSummaryDateRequestable({
      date,
      todayKey: readLocalDateState().currentLocalDateKey,
    });

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.widgetSummaryByDate({ date, userId }),
    queryFn: async ({ signal }) => unwrap(await todoApi.getTodoSummary(date, signal)),
    enabled: isRequestable,
    staleTime: MINUTE_MS,
    // 간격 재조회는 enabled를 다시 보지 않아 자정이 지나도 이미 건 타이머가 옛 날짜로 묻는다. 간격 값으로도 끈다
    refetchInterval: (query) =>
      isRequestable() ? getTodoSummaryRefetchInterval(query.state, date) : false,
    select:
      limit == null
        ? undefined
        : (summary) => ({ ...summary, topTodos: take(summary.topTodos, limit) }),
    // 전 화면 위(AuthBootProvider)의 백그라운드 쿼리라 실패를 ErrorBoundary로 보내면 콜드 스타트 fallback이 뜬다. 실패하면 위젯만 갱신되지 않는다
    throwOnError: false,
  });
}

/** 시간대 안내를 띄울지 보려고 오늘부터 읽는 내 할 일. 기기 시간대가 바뀐 순간에만 켜서 부른다 */
export function useGetUpcomingTodosQueryOptions({ todayKey }: { todayKey: DateKey }) {
  const todoApi = useTodoApi();
  const endDate = addDaysToDateKey(todayKey, UPCOMING_TODO_WINDOW_DAYS);

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.upcomingList({ startDate: todayKey, endDate }),
    queryFn: async ({ signal }) =>
      unwrap(
        await todoApi.getTodos({ startDate: todayKey, endDate, size: TODO_PAGE_SIZE.MAX }, signal),
      ),
    // 바뀐 순간의 값을 한 번 본다. 실패하면 안내 없이 넘어가고 다시 묻지 않는다
    staleTime: 0,
    retry: false,
    // 전 화면 위(NotificationProvider)의 조회라 실패를 ErrorBoundary로 보내지 않는다
    throwOnError: false,
  });
}
