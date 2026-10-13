import type { Page } from '@src/shared/types/page.type';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys';
import type { SearchedUser } from '../domains/friend.model';

/** 친구 요청 상태가 바뀐 사용자를 모든 검색 결과 캐시에서 함께 갱신한다. */
export function patchSearchedUser(
  queryClient: QueryClient,
  isTarget: (user: SearchedUser) => boolean,
  patch: Partial<SearchedUser>,
) {
  queryClient.setQueriesData<InfiniteData<Page<SearchedUser>>>(
    { queryKey: FRIEND_QUERY_KEYS.searches() },
    (old) =>
      old && {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((user) => (isTarget(user) ? { ...user, ...patch } : user)),
        })),
      },
  );
}
