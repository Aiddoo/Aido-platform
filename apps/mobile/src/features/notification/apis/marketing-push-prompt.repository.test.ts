import { createMemoryObservableSyncStorage } from '@src/shared/__tests__';
import { toInstant } from '@src/shared/date/instant';

import { createMarketingPushPromptRepository } from './marketing-push-prompt.repository';

const KEY = 'aido_marketing_push_prompt';

describe('createMarketingPushPromptRepository', () => {
  it('출시된 앱이 저장한 값을 같은 키에서 그대로 읽는다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set(KEY, JSON.stringify({ lastPromptedAt: '2026-07-19T00:00:00.000Z', count: 2 }));

    // When
    const state = createMarketingPushPromptRepository(storage).get();

    // Then
    expect(state).toEqual({ lastPromptedAt: '2026-07-19T00:00:00.000Z', count: 2 });
  });

  it('손상된 값이면 빈 상태로 읽는다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set(KEY, '{not-json');

    // When
    const state = createMarketingPushPromptRepository(storage).get();

    // Then
    expect(state).toEqual({ lastPromptedAt: null, count: 0 });
  });

  it('날짜로 읽을 수 없는 시각은 null로 바꾸고 횟수는 남긴다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set(KEY, JSON.stringify({ lastPromptedAt: 'garbage', count: 2 }));

    // When
    const state = createMarketingPushPromptRepository(storage).get();

    // Then
    expect(state).toEqual({ lastPromptedAt: null, count: 2 });
  });

  it('닫으면 시각을 바꾸고 횟수를 하나 늘린다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set(KEY, JSON.stringify({ lastPromptedAt: '2026-07-01T00:00:00.000Z', count: 1 }));
    const repository = createMarketingPushPromptRepository(storage);

    // When
    repository.dismiss(toInstant('2026-07-20T09:00:00.000Z'));

    // Then
    expect(repository.get()).toEqual({ lastPromptedAt: '2026-07-20T09:00:00.000Z', count: 2 });
  });

  it('저장값이 그대로면 같은 상태 객체를 돌려주고 닫으면 새 상태를 알린다', () => {
    // Given
    const repository = createMarketingPushPromptRepository(createMemoryObservableSyncStorage());
    const listener = jest.fn();
    repository.subscribe(listener);
    const before = repository.get();

    // When
    const unchanged = repository.get();
    repository.dismiss(toInstant('2026-07-20T09:00:00.000Z'));

    // Then
    expect(unchanged).toBe(before);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(repository.get()).toEqual({ lastPromptedAt: '2026-07-20T09:00:00.000Z', count: 1 });
  });
});
