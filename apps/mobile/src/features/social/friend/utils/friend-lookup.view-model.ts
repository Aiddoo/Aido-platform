import type { FriendUser, FriendUserPage } from '../domains/friend.model';

export function findFriendById(
  pages: ReadonlyArray<Pick<FriendUserPage, 'items'>>,
  friendId: string,
): FriendUser | null {
  for (const page of pages) {
    const friend = page.items.find((item) => item.id === friendId);
    if (friend) {
      return friend;
    }
  }
  return null;
}
