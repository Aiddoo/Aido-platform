import { USER_BLOCK_LIMITS } from '@aido/api/vocabulary';
import { useModerationApi } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import { getNextCursor, selectPageItems } from '@src/shared/domains/cursor-page.model';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';

import type { BlockedUserPage } from '../domains/user-block.model';
import { MODERATION_QUERY_KEYS } from './moderation-query-keys';

const FIRST_PAGE_CURSOR: string | undefined = undefined;

function selectBlockedUsers(blockedUserPages: InfiniteData<BlockedUserPage, string | undefined>) {
  return {
    blockedUsers: selectPageItems(blockedUserPages),
    totalCount: blockedUserPages.pages[0]?.totalCount ?? 0,
  };
}

export function useGetBlockedUsersInfiniteQueryOptions() {
  const moderationApi = useModerationApi();

  return infiniteQueryOptions({
    queryKey: MODERATION_QUERY_KEYS.blockedUsers(),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await moderationApi.getBlockedUsers(
          { cursor: pageParam, limit: USER_BLOCK_LIMITS.DEFAULT_PAGE_SIZE },
          signal,
        ),
      ),
    initialPageParam: FIRST_PAGE_CURSOR,
    getNextPageParam: getNextCursor,
    select: selectBlockedUsers,
  });
}
