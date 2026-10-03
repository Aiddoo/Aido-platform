import { useFriendService } from '@src/bootstrap/providers/di-context';
import type { FriendService } from '@src/features/friend/services/friend.service';
import { useTranslation } from '@src/shared/i18n';
import { infiniteQueryOptions } from '@tanstack/react-query';

import { findFriendById } from '../utils/find-friend-by-id';
import { toFriendUserViewModel } from '../view-models/friend-user.view-model';
import { getFriendsQueryOptions } from './get-friends-query-options';

export function getFriendQueryOptions(
  service: FriendService,
  { friendId, fallbackName }: { friendId: string; fallbackName: string },
) {
  return infiniteQueryOptions({
    ...getFriendsQueryOptions(service),
    select: (data) => {
      const friend = findFriendById(data.pages, friendId);
      return friend ? toFriendUserViewModel(friend, fallbackName) : null;
    },
  });
}

export function useGetFriendQueryOptions({ friendId }: { friendId: string }) {
  const { t } = useTranslation('friend');
  return getFriendQueryOptions(useFriendService(), { friendId, fallbackName: t('fallbackName') });
}
