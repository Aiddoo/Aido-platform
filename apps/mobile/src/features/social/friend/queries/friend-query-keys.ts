import type { Page } from '@src/shared/types/page.types';
import { type InfiniteData, queryOptions } from '@tanstack/react-query';

import type { FriendUser } from '../domains/friend.model';

export const FRIEND_QUERY_KEYS = {
  all: ['friend'] as const,
  received: () => [...FRIEND_QUERY_KEYS.all, 'received'] as const,
  sent: () => [...FRIEND_QUERY_KEYS.all, 'sent'] as const,
  friends: () =>
    queryOptions<InfiniteData<Page<FriendUser>, string | undefined>>({
      queryKey: [...FRIEND_QUERY_KEYS.all, 'friends'],
    }).queryKey,
  searches: () => [...FRIEND_QUERY_KEYS.all, 'search'] as const,
  search: ({ query }: { query: string }) => [...FRIEND_QUERY_KEYS.searches(), { query }] as const,
} as const;
