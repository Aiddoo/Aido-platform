import { createMemoryObservableSyncStorage } from '@src/shared/__tests__';
import { toInstant } from '@src/shared/date/instant';

import { createPushPromptRepository } from './push-prompt.repository';

describe('createPushPromptRepository', () => {
  it('닫은 시각을 계정마다 따로 남기고 키는 출시된 앱과 같다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const repository = createPushPromptRepository(storage);
    const dismissedAt = toInstant('2026-11-04T09:00:00.000Z');

    // When
    repository.dismiss('user-a', dismissedAt);

    // Then
    expect(storage.get('aido_push_permission_prompt_dismissed_v1:user-a')).toBe(dismissedAt);
    expect(repository.findDismissedAt('user-a')).toEqual(dismissedAt);
    expect(repository.findDismissedAt('user-b')).toBeNull();
  });

  it('저장값이 날짜가 아니면 닫은 적 없는 것으로 본다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_push_permission_prompt_dismissed_v1:user-a', 'garbage');

    // When
    const result = createPushPromptRepository(storage).findDismissedAt('user-a');

    // Then
    expect(result).toBeNull();
  });

  it('닫으면 그 계정을 구독한 곳에 알린다', () => {
    // Given
    const repository = createPushPromptRepository(createMemoryObservableSyncStorage());
    const listener = jest.fn();
    repository.subscribe('user-a', listener);

    // When
    repository.dismiss('user-a', toInstant('2026-11-04T09:00:00.000Z'));

    // Then
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
