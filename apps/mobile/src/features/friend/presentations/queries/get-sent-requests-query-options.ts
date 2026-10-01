import { useFriendService } from '@src/bootstrap/providers/di-context';
import type { FriendService } from '@src/features/friend/services/friend.service';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export function getSentRequestsQueryOptions(friendService: FriendService) {
  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.sent(),
    queryFn: async ({ pageParam, signal }) => {
      const result = await friendService.getSentRequests({ cursor: pageParam }, signal);
      return unwrap(result);
    },
    initialPageParam: undefined as string | undefined,
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
