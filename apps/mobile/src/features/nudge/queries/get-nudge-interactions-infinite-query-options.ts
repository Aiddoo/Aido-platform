import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { NUDGE_QUERY_KEYS } from '@src/features/nudge/constants/nudge-query-keys';
import { unwrap } from '@src/shared/errors/result';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';

import type { TodoNudgeService } from '../apis/todo-nudge.service';
import type { NudgeDirection, NudgeInteractionPage } from '../domains/nudge-interaction.model';

type NudgeInteractionsPageParam = { cursor?: number };
const INITIAL_PAGE: NudgeInteractionsPageParam = {};

function selectNudgeInteractions(
  data: InfiniteData<NudgeInteractionPage, NudgeInteractionsPageParam>,
) {
  return data.pages.flatMap((page) => page.items);
}

export function getNudgeInteractionsInfiniteQueryOptions(
  todoNudgeService: TodoNudgeService,
  { direction }: { direction: NudgeDirection },
) {
  return infiniteQueryOptions({
    queryKey: NUDGE_QUERY_KEYS.interactionList({ direction }),
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
    select: selectNudgeInteractions,
    staleTime: 30_000,
  });
}

export function useGetNudgeInteractionsInfiniteQueryOptions(direction: NudgeDirection) {
  return getNudgeInteractionsInfiniteQueryOptions(useTodoNudgeService(), { direction });
}
