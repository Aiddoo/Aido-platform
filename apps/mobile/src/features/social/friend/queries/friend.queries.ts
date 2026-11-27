import { useFriendApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { getNextCursor, selectPageItems } from '@src/shared/query/cursor-page';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';

import type { FriendUser, FriendUserPage } from '../domains/friend.model';
import { isValidSearchQuery } from '../schemas/friend-request.schema';
import { FRIEND_QUERY_KEYS } from './friend-query-keys';

const FIRST_PAGE_CURSOR: string | undefined = undefined;

function selectItemsWithTotal<TItem>(data: {
  pages: ReadonlyArray<{ items: readonly TItem[]; totalCount: number }>;
}) {
  return { items: selectPageItems(data), totalCount: data.pages[0]?.totalCount ?? 0 };
}

type FriendPages = InfiniteData<FriendUserPage, string | undefined>;

export function selectFriendById(
  data: { pages: ReadonlyArray<Pick<FriendUserPage, 'items'>> },
  friendId: string,
): FriendUser | null {
  for (const page of data.pages) {
    const friend = page.items.find((item) => item.id === friendId);
    if (friend) {
      return friend;
    }
  }
  return null;
}

export function useGetFriendsInfiniteQueryOptions() {
  const friendApi = useFriendApi();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.friends(),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await friendApi.getFriends({ cursor: pageParam }, signal)),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: getNextCursor,
    select: selectItemsWithTotal,
    ...PERSISTED_QUERY_OPTIONS,
    meta: { ...PERSISTED_QUERY_OPTIONS.meta, refreshOnBlockChange: true },
  });
}

/** 친구 목록 캐시에서 한 사람을 읽는다. 아직 불러오지 않은 페이지에 있으면 null이다 */
export function useGetFriendInfiniteQueryOptions({ friendId }: { friendId: string }) {
  const select = (friendPages: FriendPages) => selectFriendById(friendPages, friendId);

  return infiniteQueryOptions({ ...useGetFriendsInfiniteQueryOptions(), select });
}

export function useGetReceivedRequestsInfiniteQueryOptions() {
  const friendApi = useFriendApi();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.received(),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await friendApi.getReceivedRequests({ cursor: pageParam }, signal)),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: getNextCursor,
    select: selectItemsWithTotal,
    meta: { refreshOnBlockChange: true },
  });
}

export function useGetSentRequestsInfiniteQueryOptions() {
  const friendApi = useFriendApi();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.sent(),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await friendApi.getSentRequests({ cursor: pageParam }, signal)),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: getNextCursor,
    select: selectItemsWithTotal,
    meta: { refreshOnBlockChange: true },
  });
}

export function useGetUserSearchInfiniteQueryOptions({ query }: { query: string }) {
  const friendApi = useFriendApi();
  const trimmed = query.trim();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.search({ query: trimmed }),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await friendApi.searchUsers({ query: trimmed, cursor: pageParam }, signal)),
    initialPageParam: FIRST_PAGE_CURSOR,
    enabled: isValidSearchQuery(trimmed),
    getNextPageParam: getNextCursor,
    select: selectPageItems,
    meta: { refreshOnBlockChange: true },
  });
}
