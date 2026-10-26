import { blockedUsersResponseSchema } from '@aido/api';
import type { Page } from '@src/shared/types/page.type';
import { z } from 'zod';

import { type BlockedUser, BlockedUserSchema } from '../domains/user-block.model';

// 차단 시각은 모델 스키마가 Date로 바꾼다
export const BlockedUsersPageSchema = blockedUsersResponseSchema.extend({
  items: z.array(BlockedUserSchema),
});

export const toBlockedUsersPage = (
  dto: z.output<typeof BlockedUsersPageSchema>,
): Page<BlockedUser> => ({
  items: dto.items,
  totalCount: dto.totalCount,
  hasMore: dto.hasMore,
  nextCursor: dto.nextCursor,
});
