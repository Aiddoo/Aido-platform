import type { Page } from '@src/shared/types/page.types';
import { type InfiniteData, queryOptions } from '@tanstack/react-query';

import type { BlockedUser } from '../domains/user-block.model';

export const MODERATION_QUERY_KEYS = {
  all: ['moderation'] as const,
  blockedUsers: () =>
    queryOptions<InfiniteData<Page<BlockedUser>, string | undefined>>({
      queryKey: [...MODERATION_QUERY_KEYS.all, 'blocked-users'],
    }).queryKey,
} as const;
