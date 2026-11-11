import { mapInfiniteItems } from '@src/shared/domains/cursor-page.model';
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
  return withTotalCountChanged(removed, -1);
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
  return withTotalCountChanged(restored, 1);
}

/** 친구 요청 상태가 바뀐 사용자를 모든 검색 결과 캐시에서 함께 갱신한다. */
export function patchSearchedUser(
  queryClient: QueryClient,
  isTarget: (user: SearchedUser) => boolean,
  patch: Partial<SearchedUser>,
) {
  queryClient.setQueriesData<InfiniteData<SearchedUserPage, string | undefined>>(
    { queryKey: FRIEND_QUERY_KEYS.searches() },
    (old) =>
      old && mapInfiniteItems(old, (user) => (isTarget(user) ? { ...user, ...patch } : user)),
  );
}

export function invalidateFriends(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: FRIEND_QUERY_KEYS.all });
}
