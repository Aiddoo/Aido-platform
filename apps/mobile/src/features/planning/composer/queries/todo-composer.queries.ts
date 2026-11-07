import { useTodoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { TODO_QUERY_KEYS } from '@src/features/planning/todo/constants/todo-query-keys';
import { queryOptions } from '@tanstack/react-query';

export function useGetTodoSeriesQueryOptions({ seriesId }: { seriesId: string }) {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.series({ seriesId }),
    queryFn: async ({ signal }) => unwrap(await todoService.getTodoSeries(seriesId, signal)),
  });
}
