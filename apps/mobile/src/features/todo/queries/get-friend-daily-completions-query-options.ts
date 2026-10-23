import { useTodoService } from '@src/bootstrap/providers/di-context';
import type { TodoService } from '@src/features/todo/apis/todo.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys';
import { toCompletionsViewModel } from './get-daily-completions-query-options';

export function getFriendDailyCompletionsQueryOptions(
  service: TodoService,
  {
    friendUserId,
    startDate,
    endDate,
  }: { friendUserId: string; startDate: string; endDate: string },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.friendCompletionsByRange({
      userId: friendUserId,
      startDate,
      endDate,
    }),
    queryFn: async ({ signal }) => {
      const result = await service.getFriendDailyCompletions(
        friendUserId,
        startDate,
        endDate,
        signal,
      );
      return unwrap(result);
    },
    select: toCompletionsViewModel,
  });
}

export function useGetFriendDailyCompletionsQueryOptions({
  friendUserId,
  startDate,
  endDate,
}: {
  friendUserId: string;
  startDate: string;
  endDate: string;
}) {
  return getFriendDailyCompletionsQueryOptions(useTodoService(), {
    friendUserId,
    startDate,
    endDate,
  });
}
