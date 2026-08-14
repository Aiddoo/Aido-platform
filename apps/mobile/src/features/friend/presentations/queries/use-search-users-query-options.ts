import { useFriendService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';

import { FriendPolicy } from '../../models/friend.model';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';
import { toSearchedUserViewModel } from '../view-models/searched-user.view-model';

/**
 * 사용자 검색(이름/태그) 무한 쿼리 옵션.
 * `query`는 이미 디바운스된 값을 넘긴다. 2자 미만이면 쿼리를 실행하지 않는다(enabled).
 * 관련도 랭킹 때문에 서버 제공 불투명 `nextCursor`로 페이지네이션한다.
 */
export const useSearchUsersQueryOptions = (query: string) => {
  const friendService = useFriendService();
  const trimmed = query.trim();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.search(trimmed),
    queryFn: async ({ pageParam }) => {
      const result = await friendService.searchUsers({ query: trimmed, cursor: pageParam });
      return unwrap(result);
    },
    initialPageParam: undefined as string | undefined,
    enabled: FriendPolicy.isValidSearchQuery(trimmed),
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) {
        return undefined;
      }
      return lastPage.nextCursor ?? undefined;
    },
    select: (data) => ({
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map(toSearchedUserViewModel),
      })),
      pageParams: data.pageParams,
    }),
  });
};
