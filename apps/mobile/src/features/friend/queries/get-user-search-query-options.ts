import { useFriendService } from '@src/bootstrap/providers/di-context';
import type { FriendService } from '@src/features/friend/apis/friend.service';
import { unwrap } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import type { Page } from '@src/shared/types/page.type';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys';
import { FriendPolicy, type SearchedUser } from '../domains/friend.model';
import { toSearchedUserViewModel } from '../utils/view-models/searched-user.view-model';

type SearchUsersPageParam = { cursor?: string };
const INITIAL_SEARCH_USERS_PAGE_PARAM: SearchUsersPageParam = {};

type UserSearchData = InfiniteData<Page<SearchedUser>, SearchUsersPageParam>;

export function selectSearchedUserViewModels(data: UserSearchData, fallbackName: string) {
  return {
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((user) => toSearchedUserViewModel(user, fallbackName)),
    })),
    pageParams: data.pageParams,
  };
}

export function getUserSearchQueryOptions(
  friendService: FriendService,
  {
    query,
    select,
  }: {
    query: string;
    select: (data: UserSearchData) => ReturnType<typeof selectSearchedUserViewModels>;
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
      return lastPage.nextCursor === null ? undefined : { cursor: lastPage.nextCursor };
    },
    select,
  });
}

export function useGetUserSearchQueryOptions({ query }: { query: string }) {
  const { t } = useTranslation('friend');
  const fallbackName = t('fallbackName');
  const select = useCallback(
    (data: UserSearchData) => selectSearchedUserViewModels(data, fallbackName),
    [fallbackName],
  );

  return getUserSearchQueryOptions(useFriendService(), { query, select });
}
