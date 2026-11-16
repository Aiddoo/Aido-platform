import { toInstant } from '@src/shared/date/instant';
import { createMemorySyncStorage } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';

import { StoreReviewPolicy } from '../domains/store-review.model';
import { createStoreReviewRepository } from './store-review.repository';

const KEY = 'aido_store_review_prompt_v1:account-a';

describe('StoreReviewRepository', () => {
  it('계정별로 할 일을 끝낸 날과 요청 시각을 보존한다', () => {
    // Given
    const storage = createMemorySyncStorage();
    const repository = createStoreReviewRepository(storage);

    // When
    repository.update('account-a', (state) =>
      StoreReviewPolicy.withActiveDay(state, createDateKey('2026-10-27')),
    );
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
