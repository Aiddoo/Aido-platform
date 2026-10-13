import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import type { TodoNudgeService } from '@src/features/nudge/apis/todo-nudge.service';
import { NUDGE_QUERY_KEYS } from '@src/features/nudge/constants/nudge-query-keys';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

export function getTodoNudgeLimitQueryOptions(todoNudgeService: TodoNudgeService) {
  return queryOptions({
    queryKey: NUDGE_QUERY_KEYS.nudgeLimit(),
    queryFn: async ({ signal }) => {
      const result = await todoNudgeService.getLimitInfo(signal);
      return unwrap(result);
    },
    staleTime: 1_000 * 60,
  });
}

export function useGetTodoNudgeLimitQueryOptions() {
  return getTodoNudgeLimitQueryOptions(useTodoNudgeService());
}
