import { t } from '@src/shared/i18n';

import type { FriendUser } from '../../models/friend.model';

export interface FriendUserViewModel extends FriendUser {
  displayName: string;
}

export const toFriendUserViewModel = (friend: FriendUser): FriendUserViewModel => ({
  ...friend,
  displayName: friend.name ?? t('friend:fallbackName'),
});
