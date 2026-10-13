import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import type { TodoNudgeService } from '@src/features/nudge/apis/todo-nudge.service';
import { NUDGE_QUERY_KEYS } from '@src/features/nudge/constants/nudge-query-keys';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

export function getRemindNudgeCooldownQueryOptions(
  todoNudgeService: TodoNudgeService,
  { userId }: { userId: string },
) {
  return queryOptions({
    queryKey: NUDGE_QUERY_KEYS.remindCooldown({ userId: userId }),
    queryFn: async ({ signal }) => {
      const result = await todoNudgeService.getRemindCooldownInfo(userId, signal);
      return unwrap(result);
    },
    staleTime: 1_000 * 60,
  });
}

export function useGetRemindNudgeCooldownQueryOptions({ userId }: { userId: string }) {
  return getRemindNudgeCooldownQueryOptions(useTodoNudgeService(), { userId });
}
