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

/** 무엇을 가릴지는 서버가 정해 여기서 거르지 않는다. 알림 목록은 캐시 밖이라 호출부가 `emitNotificationsChanged`로 알린다 */
export function invalidateAfterBlockChange(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: MODERATION_QUERY_KEYS.blockedUsers() }),
    refreshFriendTodos(queryClient),
    refreshFeedTodos(queryClient),
    queryClient.invalidateQueries({ predicate: isBlockDependentQuery }),
  ]);
}
