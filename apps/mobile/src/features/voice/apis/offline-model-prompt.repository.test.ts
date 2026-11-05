import { createMemorySyncStorage } from '@src/shared/__tests__';

import { createOfflineModelPromptRepository } from './offline-model-prompt.repository';

describe('offlineModelPromptRepository', () => {
  it('거절은 사용자와 언어마다 따로 기억한다', () => {
    // Given
    const repository = createOfflineModelPromptRepository(createMemorySyncStorage());

    // When
    repository.saveDeclined('user-1', 'ko-KR');

    // Then
    expect(repository.hasDeclined('user-1', 'ko-KR')).toBe(true);
    expect(repository.hasDeclined('user-1', 'en-US')).toBe(false);
    expect(repository.hasDeclined('user-2', 'ko-KR')).toBe(false);
  });
});
