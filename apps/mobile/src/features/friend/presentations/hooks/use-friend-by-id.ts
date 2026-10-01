import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useGetFriendsQueryOptions } from '../queries/get-friends-query-options';
import type { FriendUserViewModel } from '../view-models/friend-user.view-model';

export function useFriendById(friendId: string): FriendUserViewModel | null {
  const { data } = useSuspenseInfiniteQuery(useGetFriendsQueryOptions());

  return useMemo(
    () => data.pages.flatMap((p) => p.items).find((f) => f.id === friendId) ?? null,
    [data.pages, friendId],
  );
}
