import { blockedUsersResponseSchema } from '@aido/api';

import { blockedUserSchema } from '../domains/user-block.model';
import { toBlockedUsersPage } from './user-block.mapper';

function createBlockedUsersDto() {
  return blockedUsersResponseSchema.parse({
    items: [
      {
        id: 'clz7x5p8k0005qz0z8z8z8z8z',
        userTag: 'JOHN2026',
        name: null,
        profileImage: 'russian_blue',
        blockedAt: '2026-11-02T10:30:00.000Z',
      },
    ],
    totalCount: 1,
    hasMore: false,
    nextCursor: null,
  });
}

describe('toBlockedUsersPage', () => {
  it('차단한 사용자를 앱 모델로 옮기고 차단 시각은 순간으로 읽는다', () => {
    // Given
    const dto = createBlockedUsersDto();

    // When
    const page = toBlockedUsersPage(dto);

    // Then
    expect(page).toEqual({
      items: [
        {
          id: 'clz7x5p8k0005qz0z8z8z8z8z',
          userTag: 'JOHN2026',
          name: null,
          profileImage: 'russian_blue',
          blockedAt: '2026-11-02T10:30:00.000Z',
        },
      ],
      totalCount: 1,
      nextCursor: null,
    });
  });

  it('계약을 통과한 응답은 앱 차단 모델도 통과한다', () => {
    // Given
    const dto = createBlockedUsersDto();

    // When
    const [blockedUser] = toBlockedUsersPage(dto).items;

    // Then
    expect(blockedUserSchema.parse(blockedUser)).toEqual(blockedUser);
  });
});
