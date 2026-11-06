import { createMemorySyncStorage } from '@src/shared/__tests__';

import {
  createPushPromptRepository,
  parsePushPromptDismissedAt,
  pushPromptStorageKey,
} from './push-prompt.repository';

describe('createPushPromptRepository', () => {
  it('닫은 시각을 계정마다 따로 남기고 키는 출시된 앱과 같다', () => {
    // Given
    const storage = createMemorySyncStorage();
    const dismissedAt = new Date('2026-11-04T09:00:00.000Z');

    // When
    createPushPromptRepository(storage).dismiss('user-a', dismissedAt);

    // Then
    expect(pushPromptStorageKey('user-a')).toBe('aido_push_permission_prompt_dismissed_v1:user-a');
    expect(parsePushPromptDismissedAt(storage.get(pushPromptStorageKey('user-a')))).toEqual(
      dismissedAt,
    );
    expect(parsePushPromptDismissedAt(storage.get(pushPromptStorageKey('user-b')))).toBeNull();
  });

  it('저장값이 날짜가 아니면 닫은 적 없는 것으로 본다', () => {
    // When
    const result = parsePushPromptDismissedAt('garbage');

    // Then
    expect(result).toBeNull();
  });
});
