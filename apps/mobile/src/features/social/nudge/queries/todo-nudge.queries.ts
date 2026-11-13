import { useTodoNudgeApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { DEFAULT_PAGE_SIZE } from '@src/shared/constants/page-size';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import { getNextCursor, selectPageItems } from '@src/shared/domains/cursor-page.model';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import type { NudgeThanksCursor } from '../domains/nudge-interaction.model';
import type { NudgeDirection } from '../schemas/nudge-interaction-query-key.schema';
import { TODO_NUDGE_QUERY_KEYS } from './todo-nudge-query-keys';

const FIRST_PAGE_CURSOR: number | undefined = undefined;
const FIRST_THANKS_PREVIEW_CURSOR: NudgeThanksCursor | undefined = undefined;
const NUDGE_STALE_TIME_MS = 30 * SECOND_MS;

export function useGetNudgeInteractionAvailabilityQueryOptions() {
  const todoNudgeApi = useTodoNudgeApi();

  return queryOptions({
    queryKey: TODO_NUDGE_QUERY_KEYS.interactionAvailability(),
    queryFn: async ({ signal }) => unwrap(await todoNudgeApi.getInteractionAvailability(signal)),
    staleTime: NUDGE_STALE_TIME_MS,
    meta: { refreshOnBlockChange: true },
  });
}

export function useGetNudgeInteractionQueryOptions({ nudgeId }: { nudgeId: number }) {
  const todoNudgeApi = useTodoNudgeApi();

  return queryOptions({
    queryKey: TODO_NUDGE_QUERY_KEYS.interaction({ nudgeId }),
    queryFn: async ({ signal }) => unwrap(await todoNudgeApi.getInteraction(nudgeId, signal)),
    staleTime: NUDGE_STALE_TIME_MS,
    meta: { refreshOnTodoChange: true, refreshOnBlockChange: true },
  });
}

export function useGetNudgeInteractionsInfiniteQueryOptions({
  direction,
}: {
  direction: NudgeDirection;
}) {
  const todoNudgeApi = useTodoNudgeApi();

  return infiniteQueryOptions({
    queryKey: TODO_NUDGE_QUERY_KEYS.interactionList({ direction }),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await todoNudgeApi.getInteractions(
          { direction, limit: DEFAULT_PAGE_SIZE, cursor: pageParam },
          signal,
        ),
      ),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: getNextCursor,
    select: selectPageItems,
    staleTime: NUDGE_STALE_TIME_MS,
    meta: { refreshOnTodoChange: true, refreshOnBlockChange: true },
  });
}

export function useGetNudgeThanksPreviewInfiniteQueryOptions({ todoId }: { todoId: number }) {
  const todoNudgeApi = useTodoNudgeApi();

  return infiniteQueryOptions({
    queryKey: TODO_NUDGE_QUERY_KEYS.thanksPreview({ todoId }),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await todoNudgeApi.getThanksPreview(
          todoId,
          { limit: DEFAULT_PAGE_SIZE, ...pageParam },
          signal,
        ),
      ),
    initialPageParam: FIRST_THANKS_PREVIEW_CURSOR,
    getNextPageParam: getNextCursor,
    staleTime: NUDGE_STALE_TIME_MS,
    meta: { refreshOnTodoChange: true, refreshOnBlockChange: true },
  });
}

export function useGetRemindNudgeCooldownQueryOptions({ userId }: { userId: string }) {
  const todoNudgeApi = useTodoNudgeApi();

  return queryOptions({
    queryKey: TODO_NUDGE_QUERY_KEYS.remindCooldown({ userId }),
    queryFn: async ({ signal }) => unwrap(await todoNudgeApi.getRemindCooldownInfo(userId, signal)),
    staleTime: MINUTE_MS,
    meta: { refreshOnBlockChange: true },
  });
}

export function useGetTodoNudgeLimitQueryOptions() {
  const todoNudgeApi = useTodoNudgeApi();

  return queryOptions({
    queryKey: TODO_NUDGE_QUERY_KEYS.limit(),
    queryFn: async ({ signal }) => unwrap(await todoNudgeApi.getLimitInfo(signal)),
    staleTime: MINUTE_MS,
    meta: { refreshOnPremiumChange: true, refreshOnBlockChange: true },
  });
}
