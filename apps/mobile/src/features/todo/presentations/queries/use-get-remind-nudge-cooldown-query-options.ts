import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export const useGetRemindNudgeCooldownQueryOptions = (userId: string) => {
  const todoNudgeService = useTodoNudgeService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.remindNudgeCooldown(userId),
    queryFn: async () => {
      const result = await todoNudgeService.getRemindCooldownInfo(userId);
      return unwrap(result);
    },
    staleTime: 1_000 * 60,
  });
};
