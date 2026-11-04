import { createMemorySyncStorage } from '@src/shared/__tests__';

import { createPushPromptRepository } from './push-prompt.repository';

describe('createPushPromptRepository', () => {
  it('닫은 시각을 계정마다 따로 돌려준다', () => {
    // Given
    const repository = createPushPromptRepository(createMemorySyncStorage());
    const dismissedAt = new Date('2026-11-04T09:00:00.000Z');
    repository.dismiss('user-a', dismissedAt);

    // When
    const mine = repository.getDismissedAt('user-a');
    const other = repository.getDismissedAt('user-b');

    // Then
    expect(mine).toEqual(dismissedAt);
    expect(other).toBeNull();
  });

  it('저장값이 날짜가 아니면 닫은 적 없는 것으로 본다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set('aido_push_permission_prompt_dismissed_v1:user-a', 'garbage');
    const repository = createPushPromptRepository(storage);

    // When
    const result = repository.getDismissedAt('user-a');

    // Then
    expect(result).toBeNull();
  });
});
