import type { Page } from '@src/shared/types/page.types';
import { type InfiniteData, queryOptions } from '@tanstack/react-query';

import type { FriendRequest, FriendUser, SearchedUser } from '../domains/friend.model';

export const FRIEND_QUERY_KEYS = {
  all: ['friend'] as const,
  received: () =>
    queryOptions<InfiniteData<Page<FriendRequest>, string | undefined>>({
      queryKey: [...FRIEND_QUERY_KEYS.all, 'received'],
    }).queryKey,
  sent: () =>
    queryOptions<InfiniteData<Page<FriendRequest>, string | undefined>>({
      queryKey: [...FRIEND_QUERY_KEYS.all, 'sent'],
    }).queryKey,
  friends: () =>
    queryOptions<InfiniteData<Page<FriendUser>, string | undefined>>({
      queryKey: [...FRIEND_QUERY_KEYS.all, 'friends'],
    }).queryKey,
  searches: () => [...FRIEND_QUERY_KEYS.all, 'search'] as const,
  search: ({ query }: { query: string }) =>
    queryOptions<InfiniteData<Page<SearchedUser>, { cursor?: string }>>({
      queryKey: [...FRIEND_QUERY_KEYS.searches(), { query }],
    }).queryKey,
} as const;
