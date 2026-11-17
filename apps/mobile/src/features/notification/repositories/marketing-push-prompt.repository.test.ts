import { toInstant } from '@src/shared/date/instant';
import { createMemoryObservableSyncStorage } from '@src/testing/core';

import { createMarketingPushPromptRepository } from './marketing-push-prompt.repository';

const AT = toInstant('2026-11-04T09:00:00.000Z');

describe('createMarketingPushPromptRepository', () => {
  it('손상된 값이면 닫은 적 없는 것으로 읽는다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_notification_marketing_push_prompt_v1:user-a', '{not-json');

    // When
    const state = createMarketingPushPromptRepository(storage).find('user-a');

    // Then
    expect(state).toEqual({ dismissedAt: null });
  });

  it('저장값이 그대로면 같은 객체를 돌려준다', () => {
    // Given
    const repository = createMarketingPushPromptRepository(createMemoryObservableSyncStorage());
    repository.dismiss('user-a', AT);
    const first = repository.find('user-a');

    // When
    const second = repository.find('user-a');

    // Then
    expect(second).toBe(first);
  });

  it('구독을 풀면 그 뒤 저장에는 알리지 않는다', () => {
    // Given
    const repository = createMarketingPushPromptRepository(createMemoryObservableSyncStorage());
    const listener = jest.fn();
    const unsubscribe = repository.subscribe('user-a', listener);
    repository.dismiss('user-a', AT);

    // When
    unsubscribe();
    repository.clear('user-a');

    // Then
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
