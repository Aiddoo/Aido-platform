import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { NUDGE_QUERY_KEYS } from '@src/features/nudge/constants/nudge-query-keys';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import type { TodoNudgeService } from '../apis/todo-nudge.service';

export function getNudgeInteractionAvailabilityQueryOptions(todoNudgeService: TodoNudgeService) {
  return queryOptions({
    queryKey: NUDGE_QUERY_KEYS.nudgeInteractionAvailability(),
    queryFn: async ({ signal }) =>
      unwrap(await todoNudgeService.getInteractionAvailability(signal)),
    staleTime: 30_000,
  });
}

export function useGetNudgeInteractionAvailabilityQueryOptions() {
  return getNudgeInteractionAvailabilityQueryOptions(useTodoNudgeService());
}
