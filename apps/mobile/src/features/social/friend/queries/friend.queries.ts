import { useFriendService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import type { Page } from '@src/shared/types/page.types';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys';
import { type FriendUser, isValidSearchQuery } from '../domains/friend.model';
import { findFriendById } from '../utils/find-friend-by-id';

const FIRST_PAGE_CURSOR: string | undefined = undefined;

function selectItems<TItem, TPageParam>(data: InfiniteData<Page<TItem>, TPageParam>) {
  return data.pages.flatMap((page) => page.items);
}

function selectItemsWithTotal<TItem, TPageParam>(data: InfiniteData<Page<TItem>, TPageParam>) {
  return { items: selectItems(data), totalCount: data.pages[0]?.totalCount ?? 0 };
}

type FriendPages = InfiniteData<Page<FriendUser>, string | undefined>;

export function useGetFriendsInfiniteQueryOptions() {
  const friendService = useFriendService();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.friends(),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await friendService.getFriends({ cursor: pageParam }, signal)),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.items.length === 0) {
        return undefined;
      }

      return lastPage.items.at(-1)?.followId;
    },
    select: selectItemsWithTotal,
    ...PERSISTED_QUERY_OPTIONS,
    meta: { ...PERSISTED_QUERY_OPTIONS.meta, refreshOnBlockChange: true },
  });
}

/** 친구 목록 캐시에서 한 사람을 읽는다. 아직 불러오지 않은 페이지에 있으면 null이다 */
export function useGetFriendInfiniteQueryOptions({ friendId }: { friendId: string }) {
  const select = useCallback(
    (friendPages: FriendPages) => findFriendById(friendPages.pages, friendId),
    [friendId],
  );

  return infiniteQueryOptions({ ...useGetFriendsInfiniteQueryOptions(), select });
}

export function useGetReceivedRequestsInfiniteQueryOptions() {
  const friendService = useFriendService();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.received(),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await friendService.getReceivedRequests({ cursor: pageParam }, signal)),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.items.length === 0) {
        return undefined;
      }

      return lastPage.items.at(-1)?.id;
    },
    select: selectItemsWithTotal,
    meta: { refreshOnBlockChange: true },
  });
}

export function useGetSentRequestsInfiniteQueryOptions() {
  const friendService = useFriendService();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.sent(),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await friendService.getSentRequests({ cursor: pageParam }, signal)),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.items.length === 0) {
        return undefined;
      }

      return lastPage.items.at(-1)?.id;
    },
    select: selectItemsWithTotal,
    meta: { refreshOnBlockChange: true },
  });
}

interface SearchUsersPageParam {
  cursor?: string;
}

const INITIAL_SEARCH_USERS_PAGE_PARAM: SearchUsersPageParam = {};

export function useGetUserSearchInfiniteQueryOptions({ query }: { query: string }) {
  const friendService = useFriendService();
  const trimmed = query.trim();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.search({ query: trimmed }),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(await friendService.searchUsers({ query: trimmed, cursor: pageParam.cursor }, signal)),
    initialPageParam: INITIAL_SEARCH_USERS_PAGE_PARAM,
    enabled: isValidSearchQuery(trimmed),
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.nextCursor == null) {
        return undefined;
      }

      return { cursor: lastPage.nextCursor };
    },
    select: selectItems,
    meta: { refreshOnBlockChange: true },
  });
}
