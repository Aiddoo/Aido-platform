import { createMemorySyncStorage } from '@src/shared/__tests__';

import {
  createRecognitionLanguageRepository,
  recognitionLanguageStorageKey,
} from './recognition-language.repository';

describe('recognitionLanguageRepository', () => {
  it('사용자마다 따로 저장하고 구독자에게 알린다', () => {
    // Given
    const repository = createRecognitionLanguageRepository(createMemorySyncStorage());
    const listener = jest.fn();
    repository.subscribe(listener);

    // When
    repository.save('user-1', 'en-US');

    // Then
    expect(repository.find('user-1')).toBe('en-US');
    expect(repository.find('user-2')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('알 수 없는 값이 저장돼 있으면 저장하지 않은 것으로 본다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set(recognitionLanguageStorageKey('user-1'), 'fr-FR');
    const repository = createRecognitionLanguageRepository(storage);

    // When
    const locale = repository.find('user-1');

    // Then
    expect(locale).toBeNull();
  });
});
