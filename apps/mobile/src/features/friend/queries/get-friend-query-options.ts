import { useFriendService } from '@src/bootstrap/providers/di-context';
import type { FriendService } from '@src/features/friend/apis/friend.service';
import { useTranslation } from '@src/shared/i18n';
import type { Page } from '@src/shared/types/page.type';
import { type InfiniteData, infiniteQueryOptions } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { FriendUser } from '../domains/friend.model';
import { findFriendById } from '../utils/find-friend-by-id';
import {
  type FriendUserViewModel,
  toFriendUserViewModel,
} from '../utils/view-models/friend-user.view-model';
import { getFriendsInfiniteQueryOptions } from './get-friends-infinite-query-options';

type FriendPages = InfiniteData<Page<FriendUser>, string | undefined>;

export function selectFriend(
  friendPages: FriendPages,
  { friendId, fallbackName }: { friendId: string; fallbackName: string },
): FriendUserViewModel | null {
  const friend = findFriendById(friendPages.pages, friendId);
  return friend ? toFriendUserViewModel(friend, fallbackName) : null;
}

export function getFriendQueryOptions(
  service: FriendService,
  { select }: { select: (friendPages: FriendPages) => FriendUserViewModel | null },
) {
  return infiniteQueryOptions({ ...getFriendsInfiniteQueryOptions(service), select });
}

export function useGetFriendQueryOptions({ friendId }: { friendId: string }) {
  const { t } = useTranslation('friend');
  const fallbackName = t('fallbackName');
  const select = useCallback(
    (friendPages: FriendPages) => selectFriend(friendPages, { friendId, fallbackName }),
    [friendId, fallbackName],
  );

  return getFriendQueryOptions(useFriendService(), { select });
}
