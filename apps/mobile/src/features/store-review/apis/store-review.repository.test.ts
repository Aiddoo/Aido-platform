import { createMockSyncStorage } from '@src/shared/__tests__';

import { StoreReviewTransitions } from '../domains/store-review.model';
import { createStoreReviewRepository } from './store-review.repository';

const KEY = 'aido_store_review_prompt_v1:account-a';

const createMemoryStorage = () => {
  const storage = createMockSyncStorage();
  const values = new Map<string, string>();
  storage.getString.mockImplementation((key) => values.get(key));
  storage.set.mockImplementation((key, value) => values.set(key, value));
  storage.delete.mockImplementation((key) => values.delete(key));
  return { storage, values };
};

describe('StoreReviewRepository', () => {
  it('계정별로 할 일을 끝낸 날과 요청 시각을 보존한다', () => {
    // Given
    const { storage, values } = createMemoryStorage();
    const repository = createStoreReviewRepository(storage);

    // When
    repository.update('account-a', (state) =>
      StoreReviewTransitions.recordActiveDay(state, '2026-10-27'),
    );
    repository.update('account-a', (state) =>
      StoreReviewTransitions.recordRequest(state, new Date('2026-10-27T12:00:00.000Z')),
    );

    // Then
    expect(repository.read('account-a')).toEqual({
      activeDays: ['2026-10-27'],
      requestedAt: [new Date('2026-10-27T12:00:00.000Z')],
    });
    expect(repository.read('account-b')).toEqual({ activeDays: [], requestedAt: [] });
    expect([...values.keys()]).toEqual([KEY]);
  });

  it('이전 저장 모양은 읽을 때 새 모양으로 옮기고 지난 요청을 한 번의 요청으로 이어받는다', () => {
    // Given 앱 안 확인 창을 쓰던 버전의 저장값
    const { storage, values } = createMemoryStorage();
    values.set(
      KEY,
      JSON.stringify({
        completions: [
          { todoId: 1, localDate: '2026-08-10' },
          { todoId: 2, localDate: '2026-08-10' },
          { todoId: 3, localDate: '2026-08-11' },
        ],
        dismissedAt: '2026-08-11T00:00:00.000Z',
        reviewRequestedAt: '2026-08-12T00:00:00.000Z',
      }),
    );
    const repository = createStoreReviewRepository(storage);

    // When
    const state = repository.read('account-a');

    // Then
    expect(state).toEqual({
      activeDays: ['2026-08-10', '2026-08-11'],
      requestedAt: [new Date('2026-08-12T00:00:00.000Z')],
    });
    expect(JSON.parse(values.get(KEY) ?? 'null')).toEqual({
      version: 2,
      activeDays: ['2026-08-10', '2026-08-11'],
      requestedAt: ['2026-08-12T00:00:00.000Z'],
    });
  });

  it('리뷰를 요청받지 않은 이전 사용자는 끝낸 날만 이어받는다', () => {
    // Given
    const { storage, values } = createMemoryStorage();
    values.set(
      KEY,
      JSON.stringify({
        completions: [{ todoId: 1, localDate: '2026-08-10' }],
        dismissedAt: null,
        reviewRequestedAt: null,
      }),
    );

    // When
    const state = createStoreReviewRepository(storage).read('account-a');

    // Then
    expect(state).toEqual({ activeDays: ['2026-08-10'], requestedAt: [] });
  });

  it('손상된 저장값은 안전한 빈 상태로 복구한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('{broken');

    // When
    const state = createStoreReviewRepository(storage).read('account-a');

    // Then
    expect(state).toEqual({ activeDays: [], requestedAt: [] });
  });
});
