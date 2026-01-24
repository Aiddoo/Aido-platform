import { useFriendService } from '@src/bootstrap/providers/di-provider';
import { infiniteQueryOptions } from '@tanstack/react-query';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export const getFriendsQueryOptions = () => {
  const friendService = useFriendService();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.friends(),
    queryFn: ({ pageParam }) => friendService.getFriends({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.friends.length === 0) {
        return undefined;
      }
      return lastPage.friends[lastPage.friends.length - 1]?.followId;
    },
  });
};
