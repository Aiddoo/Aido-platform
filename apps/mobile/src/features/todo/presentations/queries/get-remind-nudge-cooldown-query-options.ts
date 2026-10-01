import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import type { TodoNudgeService } from '@src/features/todo/services/todo-nudge.service';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export function getRemindNudgeCooldownQueryOptions(
  todoNudgeService: TodoNudgeService,
  { userId }: { userId: string },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.remindNudgeCooldown(userId),
    queryFn: async ({ signal }) => {
      const result = await todoNudgeService.getRemindCooldownInfo(userId, signal);
      return unwrap(result);
    },
    staleTime: 1_000 * 60,
  });
}

export function useGetRemindNudgeCooldownQueryOptions(userId: string) {
  return getRemindNudgeCooldownQueryOptions(useTodoNudgeService(), { userId });
}
