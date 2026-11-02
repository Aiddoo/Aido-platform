import { useTodoService } from '@src/bootstrap/providers/di-context';
import type { TodoService } from '@src/features/todo/apis/todo.service';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { unwrap } from '@src/shared/errors/result';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { addDaysToDateKey } from '@src/shared/utils/date-key';
import { keepPreviousData, queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';

/** 다시 열 때 먼저 보일 어제·오늘·내일 목록만 기기에 남긴다. 둘러본 다른 날짜는 콜드 스타트 복원 크기만 키운다 */
export const shouldPersistTodosByDate = ({ date, todayKey }: { date: string; todayKey: string }) =>
  date >= addDaysToDateKey(todayKey, -1) && date <= addDaysToDateKey(todayKey, 1);

export function getTodosByDateQueryOptions(
  todoService: TodoService,
  { date, todayKey }: { date: string; todayKey: string },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.listByDate({ date }),
    queryFn: async ({ signal }) =>
      unwrap(await todoService.getTodos({ startDate: date, endDate: date, size: 200 }, signal)),
    placeholderData: keepPreviousData,
    ...(shouldPersistTodosByDate({ date, todayKey }) && PERSISTED_QUERY_OPTIONS),
  });
}

export function useGetTodosByDateQueryOptions({ date }: { date: string }) {
  return getTodosByDateQueryOptions(useTodoService(), { date, todayKey: useTodayKey() });
}
