import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import type { TodoNudgeService } from '../../services/todo-nudge.service';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export function getNudgeInteractionAvailabilityQueryOptions(todoNudgeService: TodoNudgeService) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.nudgeInteractionAvailability(),
    queryFn: async ({ signal }) =>
      unwrap(await todoNudgeService.getInteractionAvailability(signal)),
    staleTime: 30_000,
  });
}

export function useGetNudgeInteractionAvailabilityQueryOptions() {
  return getNudgeInteractionAvailabilityQueryOptions(useTodoNudgeService());
}
