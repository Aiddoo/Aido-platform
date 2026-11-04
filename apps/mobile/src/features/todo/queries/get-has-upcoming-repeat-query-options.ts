import { useTodoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { addDaysToDateKey } from '@src/shared/utils/date-key';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { TodoPolicy } from '../domains/todo.model';

/** 가장 드문 반복(매월)도 한 번은 들어오는 기간 */
const UPCOMING_REPEAT_WINDOW_DAYS = 31;

/** 앞으로 한 달 안에 반복 회차가 있는지. 계정 전체의 반복 목록을 주는 API가 없어 회차로 판단한다 */
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
            endDate: addDaysToDateKey(todayKey, UPCOMING_REPEAT_WINDOW_DAYS),
            size: 200,
          },
          signal,
        ),
      );
      return todos.some(TodoPolicy.isRecurring);
    },
    throwOnError: false,
  });
}
