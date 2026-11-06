import { useFriendService } from '@src/bootstrap/providers/di-context';
import { type FriendService } from '@src/features/social/friend/apis/friend.service';
import { PERSISTED_QUERY_OPTIONS } from '@src/shared/constants/query-persistence';
import { unwrap } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import { type Page } from '@src/shared/types/page.types';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys';
import { type FriendUser, FriendPolicy, type SearchedUser } from '../domains/friend.model';
import { findFriendById } from '../utils/find-friend-by-id';
import {
  toFriendUserViewModel,
  type FriendUserViewModel,
} from '../utils/view-models/friend-user.view-model';
import { toSearchedUserViewModel } from '../utils/view-models/searched-user.view-model';

const FIRST_PAGE_CURSOR: string | undefined = undefined;

export function getFriendsInfiniteQueryOptions(friendService: FriendService) {
  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.friends(),
    queryFn: async ({ pageParam, signal }) => {
      const result = await friendService.getFriends({ cursor: pageParam }, signal);
      return unwrap(result);
    },
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.items.length === 0) {
        return undefined;
      }
      return lastPage.items[lastPage.items.length - 1]?.followId;
    },
    ...PERSISTED_QUERY_OPTIONS,
  });
}

function selectFriendUserViewModels(
  friendPages: InfiniteData<Page<FriendUser>, string | undefined>,
  fallbackName: string,
) {
  return {
    ...friendPages,
    pages: friendPages.pages.map((page) => ({
      ...page,
      items: page.items.map((friend) => toFriendUserViewModel(friend, fallbackName)),
    })),
  };
}

export function useGetFriendsInfiniteQueryOptions() {
  const { t } = useTranslation('friend');
  const fallbackName = t('fallbackName');
  const select = useCallback(
    (friendPages: InfiniteData<Page<FriendUser>, string | undefined>) =>
      selectFriendUserViewModels(friendPages, fallbackName),
    [fallbackName],
  );

  return infiniteQueryOptions({ ...getFriendsInfiniteQueryOptions(useFriendService()), select });
}

type FriendPages = InfiniteData<Page<FriendUser>, string | undefined>;

function selectFriend(
  friendPages: FriendPages,
  { friendId, fallbackName }: { friendId: string; fallbackName: string },
): FriendUserViewModel | null {
  const friend = findFriendById(friendPages.pages, friendId);
  return friend ? toFriendUserViewModel(friend, fallbackName) : null;
}

function getFriendQueryOptions(
  service: FriendService,
  { select }: { select: (friendPages: FriendPages) => FriendUserViewModel | null },
) {
  return infiniteQueryOptions({ ...getFriendsInfiniteQueryOptions(service), select });
}

export function useGetFriendQueryOptions({ friendId }: { friendId: string }) {
  const { t } = useTranslation('friend');
  const fallbackName = t('fallbackName');
  const select = useCallback(
    (friendPages: FriendPages) => selectFriend(friendPages, { friendId, fallbackName }),
    [friendId, fallbackName],
  );

  return getFriendQueryOptions(useFriendService(), { select });
}

function getReceivedRequestsQueryOptions(friendService: FriendService) {
  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.received(),
    queryFn: async ({ pageParam, signal }) => {
      const result = await friendService.getReceivedRequests({ cursor: pageParam }, signal);
      return unwrap(result);
    },
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.items.length === 0) {
        return undefined;
      }
      return lastPage.items[lastPage.items.length - 1]?.id;
    },
  });
}

export function useGetReceivedRequestsQueryOptions() {
  return getReceivedRequestsQueryOptions(useFriendService());
}

function getSentRequestsQueryOptions(friendService: FriendService) {
  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.sent(),
    queryFn: async ({ pageParam, signal }) => {
      const result = await friendService.getSentRequests({ cursor: pageParam }, signal);
      return unwrap(result);
    },
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.items.length === 0) {
        return undefined;
      }
      return lastPage.items[lastPage.items.length - 1]?.id;
    },
  });
}

export function useGetSentRequestsQueryOptions() {
  return getSentRequestsQueryOptions(useFriendService());
}

type SearchUsersPageParam = { cursor?: string };
const INITIAL_SEARCH_USERS_PAGE_PARAM: SearchUsersPageParam = {};

type UserSearchPages = InfiniteData<Page<SearchedUser>, SearchUsersPageParam>;

export function selectSearchedUserViewModels(searchPages: UserSearchPages, fallbackName: string) {
  return {
    pages: searchPages.pages.map((page) => ({
      ...page,
      items: page.items.map((user) => toSearchedUserViewModel(user, fallbackName)),
    })),
    pageParams: searchPages.pageParams,
  };
}

function getUserSearchQueryOptions(
  friendService: FriendService,
  {
    query,
    select,
  }: {
    query: string;
    select: (searchPages: UserSearchPages) => ReturnType<typeof selectSearchedUserViewModels>;
  },
) {
  const trimmed = query.trim();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.search({ query: trimmed }),
    queryFn: async ({ pageParam, signal }) => {
      const result = await friendService.searchUsers(
        { query: trimmed, cursor: pageParam.cursor },
        signal,
      );
      return unwrap(result);
    },
    initialPageParam: INITIAL_SEARCH_USERS_PAGE_PARAM,
    enabled: FriendPolicy.isValidSearchQuery({ query: trimmed }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) {
        return undefined;
      }
      return lastPage.nextCursor == null ? undefined : { cursor: lastPage.nextCursor };
    },
    select,
  });
}

export function useGetUserSearchQueryOptions({ query }: { query: string }) {
  const { t } = useTranslation('friend');
  const fallbackName = t('fallbackName');
  const select = useCallback(
    (searchPages: UserSearchPages) => selectSearchedUserViewModels(searchPages, fallbackName),
    [fallbackName],
  );

  return getUserSearchQueryOptions(useFriendService(), { query, select });
}
