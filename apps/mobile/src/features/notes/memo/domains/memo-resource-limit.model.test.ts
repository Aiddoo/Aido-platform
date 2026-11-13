import { MemoResourceLimitPolicy } from './memo-resource-limit.model';

describe('canCreateMemo', () => {
  it('최대 개수에 닿으면 만들 수 없다', () => {
    // Given
    const limit = { currentCount: 20, maxPerUser: 20 };

    // When
    const result = MemoResourceLimitPolicy.canCreateMemo(limit);

    // Then
    expect(result).toBe(false);
  });

  it('최대 개수보다 적으면 만들 수 있다', () => {
    // Given
    const limit = { currentCount: 19, maxPerUser: 20 };

    // When
    const result = MemoResourceLimitPolicy.canCreateMemo(limit);

    // Then
    expect(result).toBe(true);
  });
});
