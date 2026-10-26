import { invalidateFriends } from '@src/features/friend/queries/friend-cache';
import { invalidateNotifications } from '@src/features/notification/queries/notification-cache';
import { invalidateNudges } from '@src/features/nudge/queries/nudge-cache';
import { invalidateAllTodoComments } from '@src/features/todo-comment/queries/todo-comment-cache';
import { invalidateFeedTodos, invalidateFriendTodos } from '@src/features/todo/queries/todo-cache';
import type { QueryClient } from '@tanstack/react-query';

import { MODERATION_QUERY_KEYS } from '../constants/moderation-query-keys';

/**
 * 차단·해제가 바꾸는 화면을 다시 받는다. 무엇을 가릴지는 서버가 정하므로 목록을 여기서 거르지 않는다.
 * 차단은 친구 관계·친구 할 일·댓글·콕·알림을, 해제는 차단 목록만 바꾸지만 같은 범위를 다시 받아 맞춘다.
 */
export function invalidateAfterBlockChange(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: MODERATION_QUERY_KEYS.blockedUsers() }),
    invalidateFriends(queryClient),
    invalidateFriendTodos(queryClient),
    invalidateFeedTodos(queryClient),
    invalidateAllTodoComments(queryClient),
    invalidateNudges(queryClient),
    invalidateNotifications(queryClient),
  ]);
}
