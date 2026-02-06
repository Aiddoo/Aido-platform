import { useFriendService } from '@src/bootstrap/providers/di-provider';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';

export const getFriendsQueryOptions = () => {
  const friendService = useFriendService();

  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.friends(),
    queryFn: async ({ pageParam }) => {
      const result = await friendService.getFriends({ cursor: pageParam });
      return unwrap(result);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.items.length === 0) {
        return undefined;
      }
      return lastPage.items[lastPage.items.length - 1]?.followId;
    },
  });
};
