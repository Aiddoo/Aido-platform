import { createMemoDraftKey } from './memo-draft';

describe('createMemoDraftKey', () => {
  it('새 메모 작성과 메모별 편집을 서로 다른 초안으로 나눈다', () => {
    // Given
    const userId = 'user-1';

    // When
    const createKey = createMemoDraftKey({ userId });
    const editKey = createMemoDraftKey({ userId, memoId: 7 });

    // Then
    expect(createKey.id).toBe('user-1:memo:create');
    expect(editKey.id).toBe('user-1:memo:edit:7');
  });

  it('같은 메모라도 사용자가 다르면 초안을 공유하지 않는다', () => {
    // Given
    const memoId = 7;

    // When
    const otherKey = createMemoDraftKey({ userId: 'user-2', memoId });

    // Then
    expect(otherKey.id).not.toBe(createMemoDraftKey({ userId: 'user-1', memoId }).id);
  });
});
