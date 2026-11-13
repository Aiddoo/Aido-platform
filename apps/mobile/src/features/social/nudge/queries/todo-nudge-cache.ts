import type { QueryClient } from '@tanstack/react-query';

import type { NudgeInteraction } from '../domains/nudge-interaction.model';
import { TODO_NUDGE_QUERY_KEYS } from './todo-nudge-query-keys';

export function setNudgeInteractionInCache(queryClient: QueryClient, nudge: NudgeInteraction) {
  queryClient.setQueryData(TODO_NUDGE_QUERY_KEYS.interaction({ nudgeId: nudge.id }), nudge);
}

export function invalidateNudgeInteraction(
  queryClient: QueryClient,
  { nudgeId }: { nudgeId: number },
) {
  return queryClient.invalidateQueries({
    queryKey: TODO_NUDGE_QUERY_KEYS.interaction({ nudgeId }),
  });
}

/** 받은·보낸 콕 목록과 답장 가능 여부. 상세는 응답으로 쓰거나 그 화면 쿼리가 맡는다 */
export function invalidateNudgeInteractionLists(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: TODO_NUDGE_QUERY_KEYS.interactionLists() }),
    queryClient.invalidateQueries({ queryKey: TODO_NUDGE_QUERY_KEYS.interactionAvailability() }),
  ]);
}

/** 콕 답장·감사 전부(목록·상세·감사 미리보기). 콕 알림이 오면 무엇이 바뀌었는지 몰라 넓게 받는다 */
export function invalidateNudgeInteractions(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_NUDGE_QUERY_KEYS.interactions() });
}

export function invalidateNudgeLimit(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: TODO_NUDGE_QUERY_KEYS.limit() });
}

export function invalidateRemindNudgeCooldown(
  queryClient: QueryClient,
  { userId }: { userId: string },
) {
  return queryClient.invalidateQueries({
    queryKey: TODO_NUDGE_QUERY_KEYS.remindCooldown({ userId }),
  });
}

/** 당겨서 새로고침. 화면에 붙은 콕 조회(남은 횟수·재촉 대기·답장)만 다시 받는다 */
export function refreshNudges(queryClient: QueryClient) {
  return queryClient.refetchQueries({ queryKey: TODO_NUDGE_QUERY_KEYS.all, type: 'active' });
}
