import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';

import type { TodoNudgeService } from '../../services/todo-nudge.service';
import { TODO_QUERY_KEYS } from '../constants/todo-query-keys.constant';

type ThanksPreviewPageParam = { cursor?: number; throughNudgeId?: number };
const INITIAL_THANKS_PREVIEW_PAGE_PARAM: ThanksPreviewPageParam = {};
const THANKS_PREVIEW_PAGE_SIZE = 20;

export function getNudgeThanksPreviewInfiniteQueryOptions(
  todoNudgeService: TodoNudgeService,
  { todoId }: { todoId: number },
) {
  return infiniteQueryOptions({
    queryKey: [...TODO_QUERY_KEYS.nudgeThanks(todoId), 'pages'],
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await todoNudgeService.getThanksPreview(
          todoId,
          { limit: THANKS_PREVIEW_PAGE_SIZE, ...pageParam },
          signal,
        ),
      ),
    initialPageParam: INITIAL_THANKS_PREVIEW_PAGE_PARAM,
    getNextPageParam: (lastPage) =>
      lastPage.hasNext && lastPage.nextCursor !== null && lastPage.throughNudgeId !== null
        ? { cursor: lastPage.nextCursor, throughNudgeId: lastPage.throughNudgeId }
        : undefined,
    staleTime: 30_000,
  });
}

export function useGetNudgeThanksPreviewInfiniteQueryOptions(todoId: number) {
  return getNudgeThanksPreviewInfiniteQueryOptions(useTodoNudgeService(), { todoId });
}
