import { useFriendService } from '@src/bootstrap/providers/di-context';
import { unwrap } from '@src/shared/errors/result';
import { infiniteQueryOptions } from '@tanstack/react-query';
import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';
import { toFriendUserViewModel } from '../view-models/friend-user.view-model';

export const useGetFriendsQueryOptions = () => {
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
    select: (data) => ({
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map(toFriendUserViewModel),
      })),
      pageParams: data.pageParams,
    }),
  });
};
