import type { FriendUser } from '../../models/friend.model';

export interface FriendUserViewModel extends FriendUser {
  displayName: string;
}

export const toFriendUserViewModel = (
  friend: FriendUser,
  fallbackName: string,
): FriendUserViewModel => ({
  ...friend,
  displayName: friend.name ?? fallbackName,
});
