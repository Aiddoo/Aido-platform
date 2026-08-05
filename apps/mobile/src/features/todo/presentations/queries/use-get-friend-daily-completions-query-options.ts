import { useTodoService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';
import { toCompletionsViewModel } from './use-get-daily-completions-query-options';

export const useGetFriendDailyCompletionsQueryOptions = (
  friendUserId: string,
  startDate: string,
  endDate: string,
) => {
  const service = useTodoService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.friendCompletionsByRange(friendUserId, startDate, endDate),
    queryFn: async () => {
      const result = await service.getFriendDailyCompletions(friendUserId, startDate, endDate);
      return unwrap(result);
    },
    select: toCompletionsViewModel,
  });
};
