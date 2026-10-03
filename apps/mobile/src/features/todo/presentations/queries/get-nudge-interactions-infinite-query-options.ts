import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';

import type { NudgeDirection } from '../../models/nudge-interaction.model';
import type { TodoNudgeService } from '../../services/todo-nudge.service';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

const INITIAL_PAGE: { cursor?: number } = {};

export function getNudgeInteractionsInfiniteQueryOptions(
  todoNudgeService: TodoNudgeService,
  { direction }: { direction: NudgeDirection },
) {
  return infiniteQueryOptions({
    queryKey: TODO_QUERY_KEYS.nudgeInteractionList(direction),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await todoNudgeService.getInteractions(
          {
            direction,
            limit: 20,
            cursor: pageParam.cursor,
          },
          signal,
        ),
      ),
    initialPageParam: INITIAL_PAGE,
    getNextPageParam: (page) =>
      page.hasNext && page.nextCursor !== null ? { cursor: page.nextCursor } : undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
    staleTime: 30_000,
  });
}

export function useGetNudgeInteractionsInfiniteQueryOptions(direction: NudgeDirection) {
  return getNudgeInteractionsInfiniteQueryOptions(useTodoNudgeService(), { direction });
}
