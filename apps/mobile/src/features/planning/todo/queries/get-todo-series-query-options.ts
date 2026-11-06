import { useTodoService } from '@src/bootstrap/providers/di-context';
import type { TodoService } from '@src/features/planning/todo/apis/todo.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';

export function getTodoSeriesQueryOptions(
  todoService: TodoService,
  { seriesId }: { seriesId: string },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.series({ seriesId }),
    queryFn: async ({ signal }) => unwrap(await todoService.getTodoSeries(seriesId, signal)),
  });
}

export function useGetTodoSeriesQueryOptions({ seriesId }: { seriesId: string }) {
  return getTodoSeriesQueryOptions(useTodoService(), { seriesId });
}
