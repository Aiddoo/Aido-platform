import { TODO_SERIES_LIMITS } from '@aido/api/vocabulary';
import { useTodoService } from '@src/bootstrap/providers/di-context';
import type { TodoService } from '@src/features/planning/todo/apis/todo.service';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { unwrap } from '@src/shared/errors/result';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { queryOptions } from '@tanstack/react-query';
import { keyBy } from 'es-toolkit';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { type DailyCompletionSummary, TodoPolicy } from '../domains/todo.model';

/** 다시 열 때 먼저 보일 어제·오늘·내일 목록만 기기에 남긴다. 둘러본 다른 날짜는 콜드 스타트 복원 크기만 키운다 */
export const shouldPersistTodosByDate = ({ date, todayKey }: { date: string; todayKey: string }) =>
  date >= addDaysToDateKey(todayKey, -1) && date <= addDaysToDateKey(todayKey, 1);

function getTodosByDateQueryOptions(
  todoService: TodoService,
  { date, todayKey }: { date: string; todayKey: string },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.listByDate({ date }),
    queryFn: async ({ signal }) =>
      unwrap(await todoService.getTodos({ startDate: date, endDate: date, size: 200 }, signal)),
    ...(shouldPersistTodosByDate({ date, todayKey }) && PERSISTED_QUERY_OPTIONS),
  });
}

export function useGetTodosByDateQueryOptions({ date }: { date: string }) {
  return getTodosByDateQueryOptions(useTodoService(), { date, todayKey: useTodayKey() });
}

export type CompletionsByDate = Record<string, DailyCompletionSummary>;

export const toCompletionsViewModel = (data: {
  completions: DailyCompletionSummary[];
}): CompletionsByDate => {
  return keyBy(data.completions, (c) => c.date);
};

function getDailyCompletionsQueryOptions(
  service: TodoService,
  { startDate, endDate }: { startDate: string; endDate: string },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.completionsByRange({ startDate, endDate }),
    queryFn: async ({ signal }) => {
      const result = await service.getDailyCompletions(startDate, endDate, signal);
      return unwrap(result);
    },
    select: toCompletionsViewModel,
    ...PERSISTED_QUERY_OPTIONS,
  });
}

export function useGetDailyCompletionsQueryOptions({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  return getDailyCompletionsQueryOptions(useTodoService(), { startDate, endDate });
}

function getFriendDailyCompletionsQueryOptions(
  service: TodoService,
  {
    friendUserId,
    startDate,
    endDate,
  }: { friendUserId: string; startDate: string; endDate: string },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.friendCompletionsByRange({
      userId: friendUserId,
      startDate,
      endDate,
    }),
    queryFn: async ({ signal }) => {
      const result = await service.getFriendDailyCompletions(
        friendUserId,
        startDate,
        endDate,
        signal,
      );
      return unwrap(result);
    },
    select: toCompletionsViewModel,
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
  return getFriendDailyCompletionsQueryOptions(useTodoService(), {
    friendUserId,
    startDate,
    endDate,
  });
}

function getFriendTodosQueryOptions(
  todoService: TodoService,
  { friendUserId, date }: { friendUserId: string; date: string },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.friendListByDate({ userId: friendUserId, date }),
    queryFn: async ({ signal }) => {
      const result = await todoService.getFriendTodos(
        friendUserId,
        {
          startDate: date,
          endDate: date,
          size: 200,
        },
        signal,
      );
      return unwrap(result);
    },
  });
}

export function useGetFriendTodosQueryOptions({
  friendUserId,
  date,
}: {
  friendUserId: string;
  date: string;
}) {
  return getFriendTodosQueryOptions(useTodoService(), { friendUserId, date });
}

/**
 * 미리 만들어 둔 범위 안에 반복 회차가 있는지. 계정 전체의 반복 목록을 주는 API가 없어 회차로 판단한다.
 * 범위 전체를 봐서 다음 달부터 시작하는 규칙만 있는 계정도 놓치지 않는다.
 */
export function useGetHasUpcomingRepeatQueryOptions() {
  const todoService = useTodoService();
  const todayKey = useTodayKey();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.upcomingRepeat(),
    queryFn: async ({ signal }) => {
      const { todos } = unwrap(
        await todoService.getTodos(
          {
            startDate: todayKey,
            endDate: addDaysToDateKey(todayKey, TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS),
            size: 200,
          },
          signal,
        ),
      );
      return todos.some(TodoPolicy.isRecurringTodo);
    },
    throwOnError: false,
  });
}

/** 상세 화면이 읽는 할 일 본문·권한·집계. 댓글 목록은 todo-comment feature가 따로 가져온다. */
function getTodoDetailsQueryOptions(todoService: TodoService, { todoId }: { todoId: number }) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.details({ todoId }),
    queryFn: async ({ signal }) => unwrap(await todoService.getTodoDetails(todoId, signal)),
  });
}

export function useGetTodoDetailsQueryOptions({ todoId }: { todoId: number }) {
  return getTodoDetailsQueryOptions(useTodoService(), { todoId });
}

function getTodoExistenceQueryOptions(todoService: TodoService) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.existence(),
    queryFn: async ({ signal }) => unwrap(await todoService.getTodoExistence(signal)),
  });
}

export function useGetTodoExistenceQueryOptions() {
  return getTodoExistenceQueryOptions(useTodoService());
}

const DATE_CATCH_UP_BASE_DELAY_MS = 5_000;
const DATE_CATCH_UP_MAX_ATTEMPTS = 4;

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
interface TodoSummaryQueryParams {
  date: string;
  userId?: string | null;
}

export function getTodoSummaryQueryOptions(
  service: TodoService,
  { date, userId }: TodoSummaryQueryParams,
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.widgetSummaryByDate({ date, userId }),
    queryFn: async ({ signal }) => {
      const result = await service.getTodoSummary(date, signal);
      return unwrap(result);
    },
    staleTime: 60_000,
    refetchInterval: (query) => {
      const { data, status, dataUpdateCount, errorUpdateCount } = query.state;
      const isCaughtUp = status !== 'error' && (data == null || data.date === date);
      if (isCaughtUp) {
        return false;
      }
      const attempt = dataUpdateCount + errorUpdateCount - 1;
      return attempt < DATE_CATCH_UP_MAX_ATTEMPTS
        ? DATE_CATCH_UP_BASE_DELAY_MS * 2 ** attempt
        : false;
    },
    // AuthProvider(전 화면 상위)에서 도는 백그라운드 쿼리 — 실패가 절대 ErrorBoundary로
    // 전파되면 안 된다(콜드 스타트 fallback 재발 방지). 실패 시 위젯만 갱신되지 않는다.
    throwOnError: false,
  });
}

export function useGetTodoSummaryQueryOptions(params: TodoSummaryQueryParams) {
  return getTodoSummaryQueryOptions(useTodoService(), params);
}
