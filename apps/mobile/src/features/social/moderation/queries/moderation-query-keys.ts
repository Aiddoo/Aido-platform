import { type InfiniteData, queryOptions } from '@tanstack/react-query';

import type { BlockedUserPage } from '../domains/user-block.model';

export const MODERATION_QUERY_KEYS = {
  all: ['moderation'] as const,
  blockedUsers: () =>
    queryOptions<InfiniteData<BlockedUserPage, string | undefined>>({
      queryKey: [...MODERATION_QUERY_KEYS.all, 'blocked-users'],
    }).queryKey,
} as const;
