import { mapInfiniteItems, selectPageItems } from '@src/shared/domains/cursor-page.model';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import type {
  FriendUser,
  FriendUserPage,
  SearchedUser,
  SearchedUserPage,
} from '../domains/friend.model';
import { FRIEND_QUERY_KEYS } from './friend-query-keys';

type FriendPages = InfiniteData<FriendUserPage, string | undefined>;

/** 지운 친구가 있던 자리. 지우기가 실패하면 그 친구만 이 자리에 되돌린다 */
export interface FriendPlacement {
  friend: FriendUser;
  pageIndex: number;
  index: number;
}

export function findFriendPlacement(pages: FriendPages, userId: string): FriendPlacement | null {
  for (const [pageIndex, page] of pages.pages.entries()) {
    const index = page.items.findIndex((friend) => friend.id === userId);
    const friend = page.items[index];
    if (friend != null) {
      return { friend, pageIndex, index };
    }
  }
  return null;
}

function withTotalCountChanged(pages: FriendPages, delta: number): FriendPages {
  return {
    ...pages,
    pages: pages.pages.map((page) => ({
      ...page,
      totalCount: Math.max(0, page.totalCount + delta),
    })),
  };
}

/** 다음 커서는 그 쪽 마지막 친구의 followId다. 서버는 지운 친구의 followId로 이으면 빈 쪽을 줘, 빼거나 되돌린 쪽은 받은 마지막 친구로 커서를 다시 맞춘다 */
function withLastFriendCursor(pages: FriendPages, pageIndex: number): FriendPages {
  const page = pages.pages[pageIndex];
  const lastFriend = selectPageItems({ pages: pages.pages.slice(0, pageIndex + 1) }).at(-1);
  if (page?.nextCursor == null || lastFriend == null) {
    return pages;
  }
  return {
    ...pages,
    pages: pages.pages.map((current, index) =>
      index === pageIndex ? { ...current, nextCursor: lastFriend.followId } : current,
    ),
  };
}

export function withFriendRemoved(pages: FriendPages, userId: string): FriendPages {
  const placement = findFriendPlacement(pages, userId);
  if (placement == null) {
    return pages;
  }
  const removed = {
    ...pages,
    pages: pages.pages.map((page, pageIndex) =>
      pageIndex === placement.pageIndex
        ? { ...page, items: page.items.filter((friend) => friend.id !== userId) }
        : page,
    ),
  };
  return withTotalCountChanged(withLastFriendCursor(removed, placement.pageIndex), -1);
}

/** 그 친구 하나만 원래 자리에 되돌린다. 그사이 다른 친구를 지웠어도 그 변경은 남는다 */
export function withFriendRestored(pages: FriendPages, placement: FriendPlacement): FriendPages {
  if (findFriendPlacement(pages, placement.friend.id) != null) {
    return pages;
  }
  const pageIndex = Math.min(placement.pageIndex, pages.pages.length - 1);
  const restored = {
    ...pages,
    pages: pages.pages.map((page, index) =>
      index === pageIndex
        ? {
            ...page,
            items: [
              ...page.items.slice(0, placement.index),
              placement.friend,
              ...page.items.slice(placement.index),
            ],
          }
        : page,
    ),
  };
  return withTotalCountChanged(withLastFriendCursor(restored, pageIndex), 1);
}

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
export function updateFriendListInCache(
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
