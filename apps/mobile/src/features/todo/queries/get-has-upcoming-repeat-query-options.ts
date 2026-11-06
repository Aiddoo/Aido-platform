import { TODO_SERIES_LIMITS } from '@aido/api/vocabulary';
import { useTodoService } from '@src/bootstrap/providers/di-context';
import { addDaysToDateKey } from '@src/shared/date/date-key';
import { unwrap } from '@src/shared/errors/result';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { TodoPolicy } from '../domains/todo.model';

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
