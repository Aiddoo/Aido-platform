import { TODO_PAGE_SIZE } from '@aido/api/vocabulary';
import { useTodoApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { addDaysToDateKey, type DateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { queryOptions } from '@tanstack/react-query';
import { keyBy, take } from 'es-toolkit';

import { UPCOMING_TODO_WINDOW_DAYS } from '../constants/todo.constants';
import { type DailyCompletionSummary } from '../domains/daily-completion.model';
import type { CalendarDateRange, CompletionsByDate } from '../utils/calendar-grid.view-model';
import { getTodoSummaryRefetchInterval, shouldPersistTodosByDate } from './todo-cache';
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

function toCompletionsByDate(data: { completions: DailyCompletionSummary[] }): CompletionsByDate {
  return keyBy(data.completions, (completion) => completion.date);
}

/** 달마다 같은 키로 받아 달 안에서 날짜를 옮겨도 다시 묻지 않는다 */
export function useGetDailyCompletionsQueryOptions({ startDate, endDate }: CalendarDateRange) {
  const todoApi = useTodoApi();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.completionsByRange({ startDate, endDate }),
    queryFn: async ({ signal }) =>
      unwrap(await todoApi.getDailyCompletions(startDate, endDate, signal)),
    select: toCompletionsByDate,
    ...PERSISTED_QUERY_OPTIONS,
  });
}

export function useGetFriendDailyCompletionsQueryOptions({
  friendUserId,
  startDate,
  endDate,
}: CalendarDateRange & { friendUserId: string }) {
  const todoApi = useTodoApi();

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
    // 차단한 사람의 할 일을 보던 상세는 다시 받아 볼 수 없음 안내로 바뀐다
    meta: { refreshOnBlockChange: true },
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

interface TodoSummaryQueryInput {
  date: DateKey;
  userId: string | null;
  /** 상위 할 일을 이만큼만 고른다. 없으면 서버가 준 만큼이다 */
  limit?: number;
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
