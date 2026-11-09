import type { BlockedUser as BlockedUserDto, BlockedUsersResponse } from '@aido/api';
import { toInstant } from '@src/shared/date/instant';
import type { Page } from '@src/shared/types/page.types';
import { pick } from 'es-toolkit';

import type { BlockedUser } from '../domains/user-block.model';

export function toBlockedUser(dto: BlockedUserDto): BlockedUser {
  return {
    ...pick(dto, ['id', 'userTag', 'name', 'profileImage']),
    blockedAt: toInstant(dto.blockedAt),
  };
}

export function toBlockedUsersPage(dto: BlockedUsersResponse): Page<BlockedUser> {
  return {
    items: dto.items.map(toBlockedUser),
    totalCount: dto.totalCount,
    hasMore: dto.hasMore,
    nextCursor: dto.nextCursor,
  };
}
