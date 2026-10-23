import { FriendPolicy } from './friend.model';

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
