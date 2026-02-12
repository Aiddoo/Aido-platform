import { useTodoNudgeService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export const getTodoNudgeLimitQueryOptions = () => {
  const todoNudgeService = useTodoNudgeService();

  return queryOptions({
    queryKey: TODO_QUERY_KEYS.nudgeLimit(),
    queryFn: async () => {
      const result = await todoNudgeService.getLimitInfo();
      return unwrap(result);
    },
    staleTime: 1_000 * 60,
  });
};
