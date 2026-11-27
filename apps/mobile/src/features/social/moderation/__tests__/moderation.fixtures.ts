import {
  blockedUserSchema,
  blockedUsersResponseSchema,
  blockUserResponseSchema,
} from '@aido/api/contracts/user-block/v1';
import { createUserReportResponseSchema } from '@aido/api/contracts/user-report/v1';
import { defineFixture } from '@src/testing/fixture';

export const BLOCKED_USER_ID = 'clz7x5p8k0005qz0z8z8z8z8z';

export const createBlockedUserDto = defineFixture(blockedUserSchema, {
  id: BLOCKED_USER_ID,
  userTag: 'JOHN2026',
  name: '존',
  profileImage: 'orange_tabby',
  blockedAt: '2026-10-26T09:00:00.000Z',
});

export const createBlockedUsersDto = defineFixture(blockedUsersResponseSchema, {
  items: [createBlockedUserDto()],
  totalCount: 1,
  hasMore: false,
  nextCursor: null,
});

export const createBlockUserResponseDto = defineFixture(blockUserResponseSchema, {
  message: '사용자를 차단했습니다.',
  blockedUserId: BLOCKED_USER_ID,
  blockedAt: '2026-10-26T09:00:00.000Z',
});

export const createUserReportResponseDto = defineFixture(createUserReportResponseSchema, {
  message: '신고를 접수했습니다.',
  report: {
    id: 'clz7x5p8k0123qz0z8z8z8z8z',
    status: 'OPEN',
    createdAt: '2026-10-26T09:00:00.000Z',
  },
});
