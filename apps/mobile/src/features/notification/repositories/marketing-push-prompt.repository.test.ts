import { toInstant } from '@src/shared/date/instant';
import { createMemoryObservableSyncStorage } from '@src/testing/core';

import { createMarketingPushPromptRepository } from './marketing-push-prompt.repository';

const LEGACY_KEY = 'aido_marketing_push_prompt';
const AT = toInstant('2026-11-04T09:00:00.000Z');

describe('createMarketingPushPromptRepository', () => {
  it('출시된 앱이 기기에 남긴 기록을 로그인한 계정으로 옮기고 기기 키를 지운다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set(
      LEGACY_KEY,
      JSON.stringify({ lastPromptedAt: '2026-07-19T00:00:00.000Z', count: 2 }),
    );
    const repository = createMarketingPushPromptRepository(storage);

    // When
    repository.claimDeviceRecord('user-a');

    // Then
    expect(repository.find('user-a')).toEqual({ dismissedAt: '2026-07-19T00:00:00.000Z' });
    expect(repository.find('user-b')).toEqual({ dismissedAt: null });
    expect(storage.get(LEGACY_KEY)).toBeUndefined();
  });

  it('계정 기록이 이미 있으면 기기 기록으로 덮지 않고 기기 키만 지운다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const repository = createMarketingPushPromptRepository(storage);
    repository.dismiss('user-a', AT);
    storage.set(
      LEGACY_KEY,
      JSON.stringify({ lastPromptedAt: '2026-07-19T00:00:00.000Z', count: 1 }),
    );

    // When
    repository.claimDeviceRecord('user-a');

    // Then
    expect(repository.find('user-a')).toEqual({ dismissedAt: AT });
    expect(storage.get(LEGACY_KEY)).toBeUndefined();
  });

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
