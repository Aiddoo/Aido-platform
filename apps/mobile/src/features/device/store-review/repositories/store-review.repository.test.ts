import { toInstant } from '@src/shared/date/instant';
import { createMemorySyncStorage } from '@src/testing/core';

import { StoreReviewPolicy } from '../domains/store-review.model';
import { createStoreReviewRepository } from './store-review.repository';

const KEY = 'aido_store_review_prompt_v1:account-a';

describe('StoreReviewRepository', () => {
  it('계정별로 할 일을 끝낸 날과 요청 시각을 보존한다', () => {
    // Given
    const storage = createMemorySyncStorage();
    const repository = createStoreReviewRepository(storage);

    // When
    repository.update('account-a', (state) => StoreReviewPolicy.withActiveDay(state, '2026-10-27'));
    repository.update('account-a', (state) =>
      StoreReviewPolicy.withRequest(state, toInstant('2026-10-27T12:00:00.000Z')),
    );

    // Then
    expect(repository.find('account-a')).toEqual({
      activeDays: ['2026-10-27'],
      requestedAt: [toInstant('2026-10-27T12:00:00.000Z')],
    });
    expect(repository.find('account-b')).toBeNull();
    expect(storage.keys()).toEqual([KEY]);
  });

  it('이전 저장 모양은 읽기만 하고 다음 갱신에서 새 모양으로 저장하며 지난 요청을 한 번의 요청으로 이어받는다', () => {
    // Given
    // 앱 안 확인 창을 쓰던 버전의 저장값
    const storage = createMemorySyncStorage();
    storage.set(
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
    const state = repository.find('account-a');

    // Then
    expect(state).toEqual({
      activeDays: ['2026-08-10', '2026-08-11'],
      requestedAt: [toInstant('2026-08-12T00:00:00.000Z')],
    });
    expect(JSON.parse(storage.get(KEY) ?? 'null')).not.toHaveProperty('version');

    // When
    repository.update('account-a', (current) => ({
      ...current,
      activeDays: [...current.activeDays, '2026-08-12'],
    }));

    // Then
    expect(JSON.parse(storage.get(KEY) ?? 'null')).toEqual({
      version: 2,
      activeDays: ['2026-08-10', '2026-08-11', '2026-08-12'],
      requestedAt: ['2026-08-12T00:00:00.000Z'],
    });
  });

  it('리뷰를 요청받지 않은 이전 사용자는 끝낸 날만 이어받는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set(
      KEY,
      JSON.stringify({
        completions: [{ todoId: 1, localDate: '2026-08-10' }],
        dismissedAt: null,
        reviewRequestedAt: null,
      }),
    );

    // When
    const state = createStoreReviewRepository(storage).find('account-a');

    // Then
    expect(state).toEqual({ activeDays: ['2026-08-10'], requestedAt: [] });
  });

  it('손상된 저장값은 기록이 없는 것으로 읽는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.get.mockReturnValue('{broken');

    // When
    const state = createStoreReviewRepository(storage).find('account-a');

    // Then
    expect(state).toBeNull();
  });
});
