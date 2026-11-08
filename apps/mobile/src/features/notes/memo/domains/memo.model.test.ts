import { createMemo } from '../__tests__/memo.fixtures';
import { MemoPolicy } from './memo.model';

describe('canCreateMemo', () => {
  it('최대 개수에 닿으면 만들 수 없다', () => {
    // Given
    const limit = { currentCount: 20, maxPerUser: 20 };

    // When
    const result = MemoPolicy.canCreateMemo(limit);

    // Then
    expect(result).toBe(false);
  });

  it('최대 개수보다 적으면 만들 수 있다', () => {
    // Given
    const limit = { currentCount: 19, maxPerUser: 20 };

    // When
    const result = MemoPolicy.canCreateMemo(limit);

    // Then
    expect(result).toBe(true);
  });
});

describe('hasContentChanged', () => {
  it('앞뒤 공백만 더한 글자는 바뀌지 않은 것이다', () => {
    // Given
    const memo = createMemo({ content: '장보기' });

    // When
    const result = MemoPolicy.hasContentChanged(memo, '  장보기\n');

    // Then
    expect(result).toBe(false);
  });

  it('저장된 글자와 같으면 바뀌지 않은 것이다', () => {
    // Given
    const memo = createMemo({ content: '장보기' });

    // When
    const result = MemoPolicy.hasContentChanged(memo, '장보기');

    // Then
    expect(result).toBe(false);
  });

  it('공백을 뺀 글자가 다르면 바뀐 것이다', () => {
    // Given
    const memo = createMemo({ content: '장보기' });

    // When
    const result = MemoPolicy.hasContentChanged(memo, ' 장보기 우유 ');

    // Then
    expect(result).toBe(true);
  });
});
