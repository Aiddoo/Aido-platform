import {
  refreshFeedTodos,
  refreshFriendTodos,
} from '@src/features/planning/todo/queries/todo-cache';
import type { Query, QueryClient } from '@tanstack/react-query';

import { MODERATION_QUERY_KEYS } from './moderation-query-keys';

/** 조회 옵션이 `meta.refreshOnBlockChange`로 차단에 따라 보이는 사람이 달라진다고 밝힌 쿼리 */
function isBlockDependentQuery(query: Pick<Query, 'meta'>) {
  return query.meta?.refreshOnBlockChange === true;
}

/**
 * 차단·해제가 바꾸는 화면을 다시 받는다. 무엇을 가릴지는 서버가 정하므로 목록을 여기서 거르지 않는다.
 * 차단은 친구 관계·친구 할 일·댓글·콕을, 해제는 차단 목록만 바꾸지만 같은 범위를 다시 받아 맞춘다.
 * 알림 목록은 이 캐시 밖이라 호출부가 `emitNotificationsChanged`로 따로 알린다.
 */
export function invalidateAfterBlockChange(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: MODERATION_QUERY_KEYS.blockedUsers() }),
    refreshFriendTodos(queryClient),
    refreshFeedTodos(queryClient),
    queryClient.invalidateQueries({ predicate: isBlockDependentQuery }),
  ]);
}
