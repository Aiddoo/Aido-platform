import { useTodoService } from '@src/bootstrap/providers/di-context';
import type { TodoService } from '@src/features/todo/services/todo.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

/**
 * 오늘의 할 일 요약 (홈 위젯 스냅샷 소스).
 *
 * 키가 completions() 하위라 할 일 토글/생성/삭제 뮤테이션의 기존 invalidation을
 * 그대로 상속받고, staleTime 1분으로 포그라운드 복귀(focusManager) 시 재조회된다.
 * date 키 회전(useToday)이 자정 넘김을 새 쿼리로 만든다.
 */
export function getTodoSummaryQueryOptions(
  service: TodoService,
  { date, userId }: { date: string; userId?: string | null },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.widgetSummaryByDate(date, userId),
    queryFn: async ({ signal }) => {
      const result = await service.getTodoSummary(signal);
      return unwrap(result);
    },
    staleTime: 60_000,
    // AuthProvider(전 화면 상위)에서 도는 백그라운드 쿼리 — 실패가 절대 ErrorBoundary로
    // 전파되면 안 된다(콜드 스타트 fallback 재발 방지). 실패 시 위젯만 갱신되지 않는다.
    throwOnError: false,
  });
}

export function useGetTodoSummaryQueryOptions(date: string, userId?: string | null) {
  return getTodoSummaryQueryOptions(useTodoService(), { date, userId });
}
