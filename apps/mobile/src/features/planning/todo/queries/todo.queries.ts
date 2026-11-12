import { TODO_PAGE_SIZE } from '@aido/api/vocabulary';
import { useTodoApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { addDaysToDateKey, type DateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today';
import {
  type QueryState,
  queryOptions,
  useQueries,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { keyBy, take } from 'es-toolkit';

import type { TodoApi } from '../apis/todo.api';
import { UPCOMING_TODO_WINDOW_DAYS } from '../constants/todo.constants';
import { type DailyCompletionSummary } from '../domains/daily-completion.model';
import { type CalendarDateRange, getCalendarMonthRanges } from '../utils/calendar-grid.view-model';
import { TODO_QUERY_KEYS } from './todo-query-keys';

/** 다시 열 때 먼저 보일 어제·오늘·내일 목록만 기기에 남긴다. 둘러본 다른 날짜는 콜드 스타트 복원 크기만 키운다 */
export function shouldPersistTodosByDate({ date, todayKey }: { date: DateKey; todayKey: DateKey }) {
  return addDaysToDateKey(todayKey, -1) <= date && date <= addDaysToDateKey(todayKey, 1);
}

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

export type CompletionsByDate = Record<string, DailyCompletionSummary>;

function toCompletionsByDate(data: { completions: DailyCompletionSummary[] }): CompletionsByDate {
  return keyBy(data.completions, (completion) => completion.date);
}

type SelectedMonthQueryResult = Pick<
  UseQueryResult<CompletionsByDate>,
  'data' | 'isError' | 'error' | 'refetch'
>;

function mergeNeighborCompletions(results: Pick<UseQueryResult<CompletionsByDate>, 'data'>[]) {
  const completions: CompletionsByDate = {};
  for (const { data } of results) {
    Object.assign(completions, data);
  }
  return completions;
}

/** 겹치는 앞뒤 주는 고른 달의 결과로 그린다. 오류·다시 시도는 고른 달 기준이다 */
function toCalendarCompletions(
  selected: SelectedMonthQueryResult,
  neighborCompletions: CompletionsByDate,
) {
  return {
    completions: { ...neighborCompletions, ...selected.data },
    isError: selected.isError,
    error: selected.error,
    refetch: () => selected.refetch(),
  };
}

function toDailyCompletionsQueryOptions(todoApi: TodoApi, range: CalendarDateRange) {
  const { startDate, endDate } = range;
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.completionsByRange({ startDate, endDate }),
    queryFn: async ({ signal }) =>
      unwrap(await todoApi.getDailyCompletions(startDate, endDate, signal)),
    select: toCompletionsByDate,
    ...PERSISTED_QUERY_OPTIONS,
  });
}

export function useGetDailyCompletionsQueryOptions(range: CalendarDateRange) {
  const todoApi = useTodoApi();

  return toDailyCompletionsQueryOptions(todoApi, range);
}

/**
 * 달마다 같은 키로 고른 달을 받고, 받은 뒤 앞뒤 달을 미리 받는다. 넘긴 달은 이미 받아 둔 이웃이라
 * 점이 비는 프레임이 없다. 처음 열 때는 고른 달 하나만 먼저 묻는다
 */
export function useCalendarCompletions({ dateKey }: { dateKey: DateKey }) {
  const todoApi = useTodoApi();
  const { selected, neighbors } = getCalendarMonthRanges(dateKey);

  const selectedMonth = useQuery(toDailyCompletionsQueryOptions(todoApi, selected));
  const neighborCompletions = useQueries({
    queries: neighbors.map((range) => ({
      ...toDailyCompletionsQueryOptions(todoApi, range),
      enabled: selectedMonth.isSuccess,
    })),
    combine: mergeNeighborCompletions,
  });

  return toCalendarCompletions(selectedMonth, neighborCompletions);
}

function toFriendDailyCompletionsQueryOptions(
  todoApi: TodoApi,
  { friendUserId, startDate, endDate }: CalendarDateRange & { friendUserId: string },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.friendCompletionsByRange({
      userId: friendUserId,
      startDate,
      endDate,
    }),
    queryFn: async ({ signal }) =>
      unwrap(await todoApi.getFriendDailyCompletions(friendUserId, startDate, endDate, signal)),
    select: toCompletionsByDate,
  });
}

/** 내 달력과 같다. 볼 수 없는 친구면 고른 달 하나만 실패하고 앞뒤 달은 묻지 않는다 */
export function useFriendCalendarCompletions({
  friendUserId,
  dateKey,
}: {
  friendUserId: string;
  dateKey: DateKey;
}) {
  const todoApi = useTodoApi();
  const { selected, neighbors } = getCalendarMonthRanges(dateKey);

  const selectedMonth = useQuery(
    toFriendDailyCompletionsQueryOptions(todoApi, { ...selected, friendUserId }),
  );
  const neighborCompletions = useQueries({
    queries: neighbors.map((range) => ({
      ...toFriendDailyCompletionsQueryOptions(todoApi, { ...range, friendUserId }),
      enabled: selectedMonth.isSuccess,
    })),
    combine: mergeNeighborCompletions,
  });

  return toCalendarCompletions(selectedMonth, neighborCompletions);
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

export function useGetTodoDetailsQueryOptions({ todoId }: { todoId: number }) {
  const todoApi = useTodoApi();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.detail({ todoId }),
    queryFn: async ({ signal }) => unwrap(await todoApi.getTodoDetails(todoId, signal)),
  });
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

const DATE_CATCH_UP_BASE_DELAY_MS = 5_000;
const DATE_CATCH_UP_MAX_ATTEMPTS = 4;

interface TodoSummaryQueryInput {
  date: DateKey;
  userId: string | null;
  /** 상위 할 일을 이만큼만 고른다. 없으면 서버가 준 만큼이다 */
  limit?: number;
}

type SummaryRefetchState = Pick<
  QueryState<{ date: DateKey }>,
  'data' | 'status' | 'dataUpdateCount' | 'errorUpdateCount'
>;

/** 서버 요약이 요청한 날짜에 닿을 때까지 몇 ms 뒤에 다시 물을지. 따라잡았거나 시도를 다 썼으면 false */
export function getTodoSummaryRefetchInterval(
  { data, status, dataUpdateCount, errorUpdateCount }: SummaryRefetchState,
  date: DateKey,
) {
  const isCaughtUp = status !== 'error' && (data == null || data.date === date);
  if (isCaughtUp) {
    return false;
  }
  const attempt = dataUpdateCount + errorUpdateCount - 1;

  return attempt < DATE_CATCH_UP_MAX_ATTEMPTS ? DATE_CATCH_UP_BASE_DELAY_MS * 2 ** attempt : false;
}

/** 홈 위젯(오늘·내일)용. 자정 직후 기기·서버 날짜가 어긋나면 foreground를 기다리지 않고 5s→10s→20s→40s로 다시 묻는다 */
export function useGetTodoSummaryQueryOptions({ date, userId, limit }: TodoSummaryQueryInput) {
  const todoApi = useTodoApi();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.widgetSummaryByDate({ date, userId }),
    queryFn: async ({ signal }) => unwrap(await todoApi.getTodoSummary(date, signal)),
    staleTime: MINUTE_MS,
    refetchInterval: (query) => getTodoSummaryRefetchInterval(query.state, date),
    select:
      limit == null
        ? undefined
        : (summary) => ({ ...summary, topTodos: take(summary.topTodos, limit) }),
    // 전 화면 위(AuthBootProvider)의 백그라운드 쿼리라 실패를 ErrorBoundary로 보내면 콜드 스타트 fallback이 뜬다. 실패하면 위젯만 갱신되지 않는다
    throwOnError: false,
  });
}

/** 오늘부터 앞으로 알림 시각을 다시 계산하는 기간의 내 할 일. 기기 시간대가 바뀐 순간에만 켜서 부른다 */
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
