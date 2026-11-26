import { mapInfiniteItems } from '@src/shared/query/cursor-page';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type { SearchedUser, SearchedUserPage } from '../domains/searched-user.model';
import type { FriendPages } from './friend-pages-cache';
import { FRIEND_QUERY_KEYS } from './friend-query-keys';

/** 친구 요청 상태가 바뀐 사용자를 모든 검색 결과 캐시에서 함께 갱신한다. */
export function patchSearchedUser(
  queryClient: QueryClient,
  isTarget: (user: SearchedUser) => boolean,
  patch: Partial<SearchedUser>,
) {
  queryClient.setQueriesData<InfiniteData<SearchedUserPage, string | undefined>>(
    { queryKey: FRIEND_QUERY_KEYS.searches() },
    (pages) =>
      pages == null
        ? pages
        : mapInfiniteItems(pages, (user) => (isTarget(user) ? { ...user, ...patch } : user)),
  );
}

export function cancelFriendList(queryClient: QueryClient) {
  return queryClient.cancelQueries({ queryKey: FRIEND_QUERY_KEYS.friends(), exact: true });
}

export function getCachedFriendList(queryClient: QueryClient) {
  return queryClient.getQueryData(FRIEND_QUERY_KEYS.friends());
}

/** 받은 친구 목록이 있을 때만 바꾼다 */
export function setFriendListInCache(
  queryClient: QueryClient,
  update: (pages: FriendPages) => FriendPages,
) {
  queryClient.setQueryData(FRIEND_QUERY_KEYS.friends(), (pages) =>
    pages == null ? pages : update(pages),
  );
}

export function invalidateFriendList(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.friends(), exact: true });
}

export function invalidateFriendSearches(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.searches() });
}

export function invalidateSentFriendRequests(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.sent() });
}

export function invalidateReceivedFriendRequests(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.received() });
}

/** 친구·요청·검색 전부. 친구 알림처럼 무엇이 바뀌었는지 모를 때 쓴다 */
export function invalidateFriends(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.all });
}

/** 당겨서 새로고침. 화면에 붙은 친구·요청 조회만 다시 받는다 */
export function refreshFriends(queryClient: QueryClient) {
  return queryClient.refetchQueries({ queryKey: FRIEND_QUERY_KEYS.all, type: 'active' });
}
