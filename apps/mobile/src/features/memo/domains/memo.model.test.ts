import { createMemo } from '../__tests__/memo.fixtures';
import { MemoPolicy } from './memo.model';

describe('getMemoPreview', () => {
  it('첫 줄을 제목으로, 나머지를 본문으로 나눈다', () => {
    // Given
    const memo = createMemo({ content: ' 장보기 \n우유\n계란' });

    // When
    const preview = MemoPolicy.getMemoPreview(memo);

    // Then
    expect(preview).toEqual({ title: '장보기', body: '우유\n계란' });
  });
});

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
