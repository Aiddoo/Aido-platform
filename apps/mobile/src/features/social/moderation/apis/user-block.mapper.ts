import type { Page } from '@src/shared/types/page.types';

import type { BlockedUser, BlockedUsersPageDto } from '../schemas/user-block.schema';

export function toBlockedUsersPage(dto: BlockedUsersPageDto): Page<BlockedUser> {
  return {
    items: dto.items,
    totalCount: dto.totalCount,
    hasMore: dto.hasMore,
    nextCursor: dto.nextCursor,
  };
}
