import { useTodoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import type { TodoService } from '@src/features/planning/todo/apis/todo.service';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/constants/todo-query-keys';
import { queryOptions } from '@tanstack/react-query';

function getTodoSeriesQueryOptions(todoService: TodoService, { seriesId }: { seriesId: string }) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.series({ seriesId }),
    queryFn: async ({ signal }) => unwrap(await todoService.getTodoSeries(seriesId, signal)),
  });
}

export function useGetTodoSeriesQueryOptions({ seriesId }: { seriesId: string }) {
  return getTodoSeriesQueryOptions(useTodoService(), { seriesId });
}
