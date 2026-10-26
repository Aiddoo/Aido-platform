import { useTodoService } from '@src/bootstrap/providers/di-context';
import type { TodoService } from '@src/features/todo/apis/todo.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';

const DATE_CATCH_UP_BASE_DELAY_MS = 5_000;
const DATE_CATCH_UP_MAX_ATTEMPTS = 4;

/**
 * 하루의 할 일 요약 (홈 위젯 스냅샷 소스). 위젯은 오늘과 내일 두 날짜를 조회한다.
 *
 * 키가 completions() 하위라 할 일 토글/생성/삭제 뮤테이션의 기존 invalidation을
 * 그대로 상속받고, staleTime 1분으로 포그라운드 복귀(focusManager) 시 재조회된다.
 * date 키 회전(LocalDateProvider)이 자정 넘김을 새 쿼리로 만든다.
 *
 * 자정 직후 기기와 서버의 날짜가 잠시 어긋나면(시계 차이로 거부되거나 date를 모르는 이전 서버가
 * 다른 날짜를 돌려줌) foreground를 기다리지 않고 5s→10s→20s→40s로 4번만 다시 묻는다.
 * 내일 요청에 오늘 요약이 오면 이전 서버라 다시 물어도 바뀌지 않으므로 묻지 않는다.
 */
interface TodoSummaryQueryParams {
  date: string;
  /** 기기 기준 오늘. 내일 요청에 오늘 요약이 오면 date를 모르는 이전 서버로 본다. */
  todayDate: string;
  userId?: string | null;
}

export function getTodoSummaryQueryOptions(
  service: TodoService,
  { date, todayDate, userId }: TodoSummaryQueryParams,
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
      const isDateUnsupported = date !== todayDate && data?.date === todayDate;
      if (isDateUnsupported) {
        return false;
      }
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
