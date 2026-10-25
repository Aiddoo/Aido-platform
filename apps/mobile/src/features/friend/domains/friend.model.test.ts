import { resolveFriendLimit, FriendPolicy } from './friend.model';

describe('친구 검색 정책', () => {
  test.each([
    ['홍길', true],
    ['ab', true],
    ['  홍길동  ', true],
    ['a', false],
    [' a ', false],
    ['', false],
  ])('검색어 "%s"의 검색 가능 여부는 %s이다', (query, expected) => {
    // Given
    const input = { query };
    // When
    const result = FriendPolicy.isValidSearchQuery(input);
    // Then
    expect(result).toBe(expected);
  });

  test.each([
    ['ABCD1234', true],
    [' ABCD1234 ', true],
    ['abcd1234', false],
    ['ABC123', false],
  ])('태그 "%s"의 유효 여부는 %s이다', (userTag, expected) => {
    // Given
    const input = { userTag };
    // When
    const result = FriendPolicy.isValidTag(input);
    // Then
    expect(result).toBe(expected);
  });
});

describe('resolveFriendLimit', () => {
  it('서버가 늘어난 한도를 알려 주면 그 인원을 반환한다', () => {
    // When
    const result = resolveFriendLimit({ current: 7, limit: 7 });

    // Then
    expect(result).toBe(7);
  });

  it('한도가 없으면 무료 기본 한도를 반환한다', () => {
    // When
    const result = resolveFriendLimit(undefined);

    // Then FOLLOW_LIMITS.FREE_MAX_FRIENDS
    expect(result).toBe(5);
  });
});
