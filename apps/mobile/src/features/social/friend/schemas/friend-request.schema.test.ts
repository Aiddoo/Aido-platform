import { isValidSearchQuery } from './friend-request.schema';

describe('isValidSearchQuery', () => {
  it.each([
    ['홍길', true],
    ['ab', true],
    ['  홍길동  ', true],
    ['a', false],
    [' a ', false],
    ['', false],
  ])('검색어 "%s"의 검색 가능 여부는 %s이다', (query, expected) => {
    // When
    const result = isValidSearchQuery(query);

    // Then
    expect(result).toBe(expected);
  });
});
