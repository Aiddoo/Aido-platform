import { useFriendService } from '@src/bootstrap/providers/di-context';
import type { FriendService } from '@src/features/friend/services/friend.service';
import { unwrap } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import { infiniteQueryOptions } from '@tanstack/react-query';

import { FriendPolicy } from '../../models/friend.model';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';
import { toSearchedUserViewModel } from '../view-models/searched-user.view-model';

type SearchUsersPageParam = { cursor?: string };
const INITIAL_SEARCH_USERS_PAGE_PARAM: SearchUsersPageParam = {};

export function getSearchUsersQueryOptions(
  friendService: FriendService,
  { query, fallbackName }: { query: string; fallbackName: string },
) {
  const trimmed = query.trim();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.search(trimmed),
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
    select: (data) => ({
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((user) => toSearchedUserViewModel(user, fallbackName)),
      })),
      pageParams: data.pageParams,
    }),
  });
}

export function useSearchUsersQueryOptions(query: string) {
  const { t } = useTranslation('friend');
  return getSearchUsersQueryOptions(useFriendService(), { query, fallbackName: t('fallbackName') });
}
