import type { BlockedUser as BlockedUserDto, BlockedUsersResponse } from '@aido/api';
import { toInstant } from '@src/shared/date/instant';
import { pick } from 'es-toolkit';

import type { BlockedUser, BlockedUserPage } from '../domains/user-block.model';

export function toBlockedUser(dto: BlockedUserDto): BlockedUser {
  return {
    ...pick(dto, ['id', 'userTag', 'name', 'profileImage']),
    blockedAt: toInstant(dto.blockedAt),
  };
}

// 차단 목록은 사용자 id가 아니라 서버가 준 차단 관계 커서로 이어 받는다
export function toBlockedUsersPage(dto: BlockedUsersResponse): BlockedUserPage {
  return {
    items: dto.items.map(toBlockedUser),
    nextCursor: dto.hasMore ? dto.nextCursor : null,
    totalCount: dto.totalCount,
  };
}
