import { TODO_SERIES_LIMITS } from '@aido/api/vocabulary';
import { useTodoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { type QueryState, queryOptions } from '@tanstack/react-query';
import { keyBy } from 'es-toolkit';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { TodoPolicy } from '../domains/todo.model';
import { type DailyCompletionSummary } from '../schemas/todo.schema';

const TODOS_PER_DAY_PAGE_SIZE = 200;

/** 다시 열 때 먼저 보일 어제·오늘·내일 목록만 기기에 남긴다. 둘러본 다른 날짜는 콜드 스타트 복원 크기만 키운다 */
export function shouldPersistTodosByDate({ date, todayKey }: { date: string; todayKey: string }) {
  return addDaysToDateKey(todayKey, -1) <= date && date <= addDaysToDateKey(todayKey, 1);
}

export function useGetTodosByDateQueryOptions({ date }: { date: string }) {
  const todoService = useTodoService();
  const todayKey = useTodayKey();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.listByDate({ date }),
    queryFn: async ({ signal }) =>
      unwrap(
        await todoService.getTodos(
          { startDate: date, endDate: date, size: TODOS_PER_DAY_PAGE_SIZE },
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

export function useGetDailyCompletionsQueryOptions({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.completionsByRange({ startDate, endDate }),
    queryFn: async ({ signal }) =>
      unwrap(await todoService.getDailyCompletions(startDate, endDate, signal)),
    select: toCompletionsByDate,
    ...PERSISTED_QUERY_OPTIONS,
  });
}

export function useGetFriendDailyCompletionsQueryOptions({
  friendUserId,
  startDate,
  endDate,
}: {
  friendUserId: string;
  startDate: string;
  endDate: string;
}) {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.friendCompletionsByRange({
      userId: friendUserId,
      startDate,
      endDate,
    }),
    queryFn: async ({ signal }) =>
      unwrap(await todoService.getFriendDailyCompletions(friendUserId, startDate, endDate, signal)),
    select: toCompletionsByDate,
  });
}

export function useGetFriendTodosQueryOptions({
  friendUserId,
  date,
}: {
  friendUserId: string;
  date: string;
}) {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.friendListByDate({ userId: friendUserId, date }),
    queryFn: async ({ signal }) =>
      unwrap(
        await todoService.getFriendTodos(
          friendUserId,
          { startDate: date, endDate: date, size: TODOS_PER_DAY_PAGE_SIZE },
          signal,
        ),
      ),
  });
}

/**
 * 미리 만들어 둔 범위 안에 반복 회차가 있는지. 계정 전체의 반복 목록을 주는 API가 없어 회차로 판단한다.
 * 범위 전체를 봐서 다음 달부터 시작하는 규칙만 있는 계정도 놓치지 않는다.
 */
export function useGetHasUpcomingRepeatQueryOptions() {
  const todoService = useTodoService();
  const todayKey = useTodayKey();

  return queryOptions({
    // 키에 날짜가 있어야 자정이 지나면 어제 기준으로 구한 값을 쓰지 않고 새로 묻는다
    queryKey: TODO_QUERY_KEYS.upcomingRepeat({ date: todayKey }),
    queryFn: async ({ signal }) => {
      const { todos } = unwrap(
        await todoService.getTodos(
          {
            startDate: todayKey,
            endDate: addDaysToDateKey(todayKey, TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS),
            size: TODOS_PER_DAY_PAGE_SIZE,
          },
          signal,
        ),
      );
      return todos.some(TodoPolicy.isRecurringTodo);
    },
    throwOnError: false,
  });
}

export function useGetTodoDetailsQueryOptions({ todoId }: { todoId: number }) {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.detail({ todoId }),
    queryFn: async ({ signal }) => unwrap(await todoService.getTodoDetails(todoId, signal)),
  });
}

export function useGetTodoExistenceQueryOptions() {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.existence(),
    queryFn: async ({ signal }) => unwrap(await todoService.getTodoExistence(signal)),
  });
}

const DATE_CATCH_UP_BASE_DELAY_MS = 5_000;
const DATE_CATCH_UP_MAX_ATTEMPTS = 4;

interface TodoSummaryQueryInput {
  date: string;
  userId?: string | null;
}

type SummaryRefetchState = Pick<
  QueryState<{ date: string }>,
  'data' | 'status' | 'dataUpdateCount' | 'errorUpdateCount'
>;

/** 서버 요약이 요청한 날짜에 닿을 때까지 몇 ms 뒤에 다시 물을지. 따라잡았거나 시도를 다 썼으면 false */
export function getTodoSummaryRefetchInterval(
  { data, status, dataUpdateCount, errorUpdateCount }: SummaryRefetchState,
  date: string,
) {
  const isCaughtUp = status !== 'error' && (data == null || data.date === date);
  if (isCaughtUp) {
    return false;
  }
  const attempt = dataUpdateCount + errorUpdateCount - 1;

  return attempt < DATE_CATCH_UP_MAX_ATTEMPTS ? DATE_CATCH_UP_BASE_DELAY_MS * 2 ** attempt : false;
}

/**
 * 하루의 할 일 요약 (홈 위젯 스냅샷 소스). 위젯은 오늘과 내일 두 날짜를 조회한다.
 *
 * 키가 completions() 하위라 할 일 토글/생성/삭제 뮤테이션의 기존 invalidation을
 * 그대로 상속받고, staleTime 1분으로 포그라운드 복귀(focusManager) 시 재조회된다.
 * date 키 회전(LocalDateProvider)이 자정 넘김을 새 쿼리로 만든다.
 *
 * 자정 직후 기기와 서버의 날짜가 잠시 어긋나면(시계 차이로 거부되거나 다른 날짜를 돌려줌)
 * foreground를 기다리지 않고 5s→10s→20s→40s로 4번만 다시 묻는다.
 */
export function useGetTodoSummaryQueryOptions({ date, userId }: TodoSummaryQueryInput) {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.widgetSummaryByDate({ date, userId }),
    queryFn: async ({ signal }) => unwrap(await todoService.getTodoSummary(date, signal)),
    staleTime: MINUTE_MS,
    refetchInterval: (query) => getTodoSummaryRefetchInterval(query.state, date),
    // AuthBootProvider(전 화면 상위)에서 도는 백그라운드 쿼리 — 실패가 절대 ErrorBoundary로
    // 전파되면 안 된다(콜드 스타트 fallback 재발 방지). 실패 시 위젯만 갱신되지 않는다.
    throwOnError: false,
  });
}
