import { useFriendService } from '@src/bootstrap/providers/di-context';
import type { FriendService } from '@src/features/friend/services/friend.service';
import { unwrap } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import { infiniteQueryOptions } from '@tanstack/react-query';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys.constant';
import { toFriendUserViewModel } from '../view-models/friend-user.view-model';

export function getFriendsQueryOptions(friendService: FriendService) {
  return infiniteQueryOptions({
    queryKey: FRIEND_QUERY_KEYS.friends(),
    queryFn: async ({ pageParam, signal }) => {
      const result = await friendService.getFriends({ cursor: pageParam }, signal);
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
}

export function useGetFriendsQueryOptions() {
  const { t } = useTranslation('friend');
  const fallbackName = t('fallbackName');
  return infiniteQueryOptions({
    ...getFriendsQueryOptions(useFriendService()),
    select: (data) => ({
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((friend) => toFriendUserViewModel(friend, fallbackName)),
      })),
    }),
  });
}
