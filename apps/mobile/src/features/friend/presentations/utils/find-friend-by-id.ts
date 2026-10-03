import type { Page } from '@src/shared/types/page.type';

import type { FriendUser } from '../../models/friend.model';

export const findFriendById = (
  pages: ReadonlyArray<Pick<Page<FriendUser>, 'items'>>,
  friendId: string,
): FriendUser | null => {
  for (const page of pages) {
    const friend = page.items.find((item) => item.id === friendId);
    if (friend) return friend;
  }
  return null;
};
