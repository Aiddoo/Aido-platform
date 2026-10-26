import { useFriendService } from '@src/bootstrap/providers/di-context';
import type { FriendService } from '@src/features/friend/apis/friend.service';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys';

const FIRST_PAGE_CURSOR: string | undefined = undefined;

export function getReceivedRequestsQueryOptions(friendService: FriendService) {
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
