import { useFriendService } from '@src/bootstrap/providers/di-provider';
import { infiniteQueryOptions } from '@tanstack/react-query';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export const getReceivedRequestsQueryOptions = () => {
  const friendService = useFriendService();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.received(),
    queryFn: ({ pageParam }) => friendService.getReceivedRequests({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.requests.length === 0) {
        return undefined;
      }
      return lastPage.requests[lastPage.requests.length - 1]?.id;
    },
  });
};
