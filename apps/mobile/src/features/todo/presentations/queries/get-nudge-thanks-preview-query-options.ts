import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions } from '@tanstack/react-query';

import type { TodoNudgeService } from '../../services/todo-nudge.service';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

export function getNudgeThanksPreviewQueryOptions(
  todoNudgeService: TodoNudgeService,
  { todoId }: { todoId: number },
) {
  return queryOptions({
    queryKey: TODO_QUERY_KEYS.nudgeThanks(todoId),
    queryFn: async ({ signal }) => unwrap(await todoNudgeService.getThanksPreview(todoId, signal)),
    staleTime: 30_000,
  });
}

export function useGetNudgeThanksPreviewQueryOptions(todoId: number) {
  return getNudgeThanksPreviewQueryOptions(useTodoNudgeService(), { todoId });
}
