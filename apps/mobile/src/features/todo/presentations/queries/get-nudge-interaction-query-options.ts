import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import type { TodoNudgeService } from '../../services/todo-nudge.service';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export function getNudgeInteractionQueryOptions(
  todoNudgeService: TodoNudgeService,
  { nudgeId }: { nudgeId: number },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.nudgeInteraction(nudgeId),
    queryFn: async ({ signal }) => unwrap(await todoNudgeService.getInteraction(nudgeId, signal)),
    staleTime: 30_000,
  });
}

export function useGetNudgeInteractionQueryOptions(nudgeId: number) {
  return getNudgeInteractionQueryOptions(useTodoNudgeService(), { nudgeId });
}
