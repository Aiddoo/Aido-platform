import { useFriendService } from '@src/bootstrap/providers/di-context';
import type { FriendService } from '@src/features/friend/apis/friend.service';
import { unwrap } from '@src/shared/errors/result';
import { useTranslation } from '@src/shared/i18n';
import type { Page } from '@src/shared/types/page.type';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

import { FRIEND_QUERY_KEYS } from '../constants/friend-query-keys';
import type { FriendUser } from '../domains/friend.model';
import { toFriendUserViewModel } from '../utils/view-models/friend-user.view-model';

export function getFriendsInfiniteQueryOptions(friendService: FriendService) {
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

export function selectFriendUserViewModels(
  data: InfiniteData<Page<FriendUser>, string | undefined>,
  fallbackName: string,
) {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((friend) => toFriendUserViewModel(friend, fallbackName)),
    })),
  };
}

export function useGetFriendsInfiniteQueryOptions() {
  const { t } = useTranslation('friend');
  const fallbackName = t('fallbackName');
  const select = useCallback(
    (data: InfiniteData<Page<FriendUser>, string | undefined>) =>
      selectFriendUserViewModels(data, fallbackName),
    [fallbackName],
  );

  return infiniteQueryOptions({ ...getFriendsInfiniteQueryOptions(useFriendService()), select });
}
