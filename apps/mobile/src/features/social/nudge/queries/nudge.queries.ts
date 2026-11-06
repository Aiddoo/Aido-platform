import { useTodoNudgeService } from '@src/bootstrap/providers/di-context';
import { NUDGE_QUERY_KEYS } from '@src/features/social/nudge/constants/nudge-query-keys';
import { DEFAULT_PAGE_SIZE } from '@src/shared/constants/query.constants';
import { unwrap } from '@src/shared/errors/result';
import { queryOptions, type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';

import { type TodoNudgeService } from '../apis/todo-nudge.service';
import { type NudgeDirection, type NudgeInteractionPage } from '../domains/nudge-interaction.model';

function getNudgeInteractionAvailabilityQueryOptions(todoNudgeService: TodoNudgeService) {
  return queryOptions({
    queryKey: NUDGE_QUERY_KEYS.interactionAvailability(),
    queryFn: async ({ signal }) =>
      unwrap(await todoNudgeService.getInteractionAvailability(signal)),
    staleTime: 30_000,
  });
}

export function useGetNudgeInteractionAvailabilityQueryOptions() {
  return getNudgeInteractionAvailabilityQueryOptions(useTodoNudgeService());
}

function getNudgeInteractionQueryOptions(
  todoNudgeService: TodoNudgeService,
  { nudgeId }: { nudgeId: number },
) {
  return queryOptions({
    queryKey: NUDGE_QUERY_KEYS.interaction({ nudgeId: nudgeId }),
    queryFn: async ({ signal }) => unwrap(await todoNudgeService.getInteraction(nudgeId, signal)),
    staleTime: 30_000,
  });
}

export function useGetNudgeInteractionQueryOptions({ nudgeId }: { nudgeId: number }) {
  return getNudgeInteractionQueryOptions(useTodoNudgeService(), { nudgeId });
}

type NudgeInteractionsPageParam = { cursor?: number };
const INITIAL_PAGE: NudgeInteractionsPageParam = {};

function selectNudgeInteractions(
  infinitePages: InfiniteData<NudgeInteractionPage, NudgeInteractionsPageParam>,
) {
  return infinitePages.pages.flatMap((page) => page.items);
}

function getNudgeInteractionsInfiniteQueryOptions(
  todoNudgeService: TodoNudgeService,
  { direction }: { direction: NudgeDirection },
) {
  return infiniteQueryOptions({
    queryKey: NUDGE_QUERY_KEYS.interactionList({ direction }),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await todoNudgeService.getInteractions(
          {
            direction,
            limit: DEFAULT_PAGE_SIZE,
            cursor: pageParam.cursor,
          },
          signal,
        ),
      ),
    initialPageParam: INITIAL_PAGE,
    getNextPageParam: (page) =>
      page.hasNext && page.nextCursor != null ? { cursor: page.nextCursor } : undefined,
    select: selectNudgeInteractions,
    staleTime: 30_000,
  });
}

export function useGetNudgeInteractionsInfiniteQueryOptions({
  direction,
}: {
  direction: NudgeDirection;
}) {
  return getNudgeInteractionsInfiniteQueryOptions(useTodoNudgeService(), { direction });
}

type ThanksPreviewPageParam = { cursor?: number; throughNudgeId?: number };
const INITIAL_THANKS_PREVIEW_PAGE_PARAM: ThanksPreviewPageParam = {};
const THANKS_PREVIEW_PAGE_SIZE = 20;

function getNudgeThanksPreviewInfiniteQueryOptions(
  todoNudgeService: TodoNudgeService,
  { todoId }: { todoId: number },
) {
  return infiniteQueryOptions({
    queryKey: NUDGE_QUERY_KEYS.thanksPreview({ todoId }),
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
      lastPage.hasNext && lastPage.nextCursor != null && lastPage.throughNudgeId != null
        ? { cursor: lastPage.nextCursor, throughNudgeId: lastPage.throughNudgeId }
        : undefined,
    staleTime: 30_000,
  });
}

export function useGetNudgeThanksPreviewInfiniteQueryOptions({ todoId }: { todoId: number }) {
  return getNudgeThanksPreviewInfiniteQueryOptions(useTodoNudgeService(), { todoId });
}

function getRemindNudgeCooldownQueryOptions(
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

function getTodoNudgeLimitQueryOptions(todoNudgeService: TodoNudgeService) {
  return queryOptions({
    queryKey: NUDGE_QUERY_KEYS.limit(),
    queryFn: async ({ signal }) => {
      const result = await todoNudgeService.getLimitInfo(signal);
      return unwrap(result);
    },
    staleTime: 1_000 * 60,
    meta: { refreshOnPremiumChange: true },
  });
}

export function useGetTodoNudgeLimitQueryOptions() {
  return getTodoNudgeLimitQueryOptions(useTodoNudgeService());
}
