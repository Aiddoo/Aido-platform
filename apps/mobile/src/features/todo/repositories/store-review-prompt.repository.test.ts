import { createMockSyncStorage } from '@src/shared/__tests__';

import { createStoreReviewPromptRepository } from './store-review-prompt.repository';

describe('StoreReviewPromptRepository', () => {
  const createMemoryStorage = () => {
    const storage = createMockSyncStorage();
    const values = new Map<string, string>();
    storage.getString.mockImplementation((key) => values.get(key));
    storage.set.mockImplementation((key, value) => values.set(key, value));
    storage.delete.mockImplementation((key) => values.delete(key));
    return { storage, values };
  };

  it('계정별로 성공 완료를 보존하고 같은 할 일/날짜는 중복 저장하지 않는다', () => {
    const { storage, values } = createMemoryStorage();
    const repository = createStoreReviewPromptRepository(storage);

    repository.recordSuccessfulCompletion('account-a', {
      todoId: 1,
      localDate: '2026-08-10',
    });
    repository.recordSuccessfulCompletion('account-a', {
      todoId: 1,
      localDate: '2026-08-10',
    });

    expect(repository.read('account-a').completions).toEqual([
      { todoId: 1, localDate: '2026-08-10' },
    ]);
    expect(repository.read('account-b').completions).toEqual([]);
    expect([...values.keys()]).toEqual(['aido_store_review_prompt_v1:account-a']);
  });

  it('거절 및 리뷰 요청 시각을 각각 기록한다', () => {
    const { storage } = createMemoryStorage();
    const repository = createStoreReviewPromptRepository(storage);

    repository.recordDismissal('account-a', new Date('2026-08-12T00:00:00.000Z'));
    expect(repository.read('account-a').dismissedAt).toBe('2026-08-12T00:00:00.000Z');

    repository.recordReviewRequested('account-a', new Date('2026-08-13T00:00:00.000Z'));
    expect(repository.read('account-a').reviewRequestedAt).toBe('2026-08-13T00:00:00.000Z');
  });

  it('손상되거나 구버전인 저장값은 안전한 빈 상태로 복구한다', () => {
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('{broken');
    const repository = createStoreReviewPromptRepository(storage);

    expect(repository.read('account-a')).toEqual({
      completions: [],
      dismissedAt: null,
      reviewRequestedAt: null,
    });
  });
});
