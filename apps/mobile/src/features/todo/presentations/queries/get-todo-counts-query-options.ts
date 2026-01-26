import { useTodoService } from '@src/bootstrap/providers/di-provider';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export const getTodoCountsQueryOptions = (startDate: string, endDate: string) => {
  const todoService = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.counts(startDate, endDate),
    queryFn: () => todoService.getTodoCounts({ startDate, endDate }),
  });
};
