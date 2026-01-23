import { useFriendRequestService } from '@src/bootstrap/providers/di-provider';
import { infiniteQueryOptions } from '@tanstack/react-query';
import { FRIEND_REQUEST_QUERY_KEYS } from '../constants/friend-request-query-keys.constant';

export const getSentRequestsQueryOptions = () => {
  const friendRequestService = useFriendRequestService();

  return infiniteQueryOptions({
    queryKey: FRIEND_REQUEST_QUERY_KEYS.sent(),
    queryFn: ({ pageParam }) => friendRequestService.getSentRequests({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.requests.length === 0) {
        return undefined;
      }
      return lastPage.requests[lastPage.requests.length - 1]?.id;
    },
  });
};
