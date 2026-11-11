import { USER_BLOCK_LIMITS } from '@aido/api/vocabulary';
import { useModerationService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/core/errors/result';
import type { Page } from '@src/shared/types/page.types';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';

import type { BlockedUser } from '../domains/user-block.model';
import { MODERATION_QUERY_KEYS } from './moderation-query-keys';

const FIRST_PAGE_CURSOR: string | undefined = undefined;

function selectBlockedUsers(blockedUserPages: InfiniteData<Page<BlockedUser>, string | undefined>) {
  return {
    blockedUsers: blockedUserPages.pages.flatMap((page) => page.items),
    totalCount: blockedUserPages.pages[0]?.totalCount ?? 0,
  };
}

export function useGetBlockedUsersInfiniteQueryOptions() {
  const moderationService = useModerationService();

  return infiniteQueryOptions({
    queryKey: MODERATION_QUERY_KEYS.blockedUsers(),
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await moderationService.getBlockedUsers(
          { cursor: pageParam, limit: USER_BLOCK_LIMITS.DEFAULT_PAGE_SIZE },
          signal,
        ),
      ),
    initialPageParam: FIRST_PAGE_CURSOR,
    // 차단 목록은 사용자 ID가 아니라 서버가 준 차단 관계 cursor로 이어 받는다
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    select: selectBlockedUsers,
  });
}
