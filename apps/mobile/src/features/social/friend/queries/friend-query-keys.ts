import { type InfiniteData, queryOptions } from '@tanstack/react-query';

import type { FriendRequestPage } from '../domains/friend-request.model';
import type { FriendUserPage } from '../domains/friend.model';
import type { SearchedUserPage } from '../domains/searched-user.model';

export const FRIEND_QUERY_KEYS = {
  all: ['friend'] as const,
  received: () =>
    queryOptions<InfiniteData<FriendRequestPage, string | undefined>>({
      queryKey: [...FRIEND_QUERY_KEYS.all, 'received'],
    }).queryKey,
  sent: () =>
    queryOptions<InfiniteData<FriendRequestPage, string | undefined>>({
      queryKey: [...FRIEND_QUERY_KEYS.all, 'sent'],
    }).queryKey,
  friends: () =>
    queryOptions<InfiniteData<FriendUserPage, string | undefined>>({
      queryKey: [...FRIEND_QUERY_KEYS.all, 'friends'],
    }).queryKey,
  searches: () => [...FRIEND_QUERY_KEYS.all, 'search'] as const,
  search: ({ query }: { query: string }) =>
    queryOptions<InfiniteData<SearchedUserPage, string | undefined>>({
      queryKey: [...FRIEND_QUERY_KEYS.searches(), { query }],
    }).queryKey,
} as const;
