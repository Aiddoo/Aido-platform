import { createMemoDraftKey } from './memo-draft';

describe('createMemoDraftKey', () => {
  it('새 메모 작성과 메모별 편집을 서로 다른 초안으로 나눈다', () => {
    expect(createMemoDraftKey({ userId: 'user-1' }).id).toBe('user-1:memo:create');
    expect(createMemoDraftKey({ userId: 'user-1', memoId: 7 }).id).toBe('user-1:memo:edit:7');
    expect(createMemoDraftKey({ userId: 'user-1', memoId: 8 }).id).not.toBe(
      createMemoDraftKey({ userId: 'user-1', memoId: 7 }).id,
    );
  });

  it('같은 메모라도 사용자가 다르면 초안을 공유하지 않는다', () => {
    expect(createMemoDraftKey({ userId: 'user-2', memoId: 7 }).id).not.toBe(
      createMemoDraftKey({ userId: 'user-1', memoId: 7 }).id,
    );
  });
});
