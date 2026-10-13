import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { NUDGE_QUERY_KEYS } from '@src/features/nudge/constants/nudge-query-keys';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import type { TodoNudgeService } from '../apis/todo-nudge.service';

export function getNudgeInteractionQueryOptions(
  todoNudgeService: TodoNudgeService,
  { nudgeId }: { nudgeId: number },
) {
  return queryOptions({
    queryKey: NUDGE_QUERY_KEYS.nudgeInteraction(nudgeId),
    queryFn: async ({ signal }) => unwrap(await todoNudgeService.getInteraction(nudgeId, signal)),
    staleTime: 30_000,
  });
}

export function useGetNudgeInteractionQueryOptions(nudgeId: number) {
  return getNudgeInteractionQueryOptions(useTodoNudgeService(), { nudgeId });
}
