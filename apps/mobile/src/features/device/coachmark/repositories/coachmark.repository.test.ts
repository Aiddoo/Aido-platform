import { createMemorySyncStorage } from '@src/testing/core';

import { createCoachmarkRepository } from './coachmark.repository';

function createStorageWith(keys: Readonly<Record<string, string>>) {
  const storage = createMemorySyncStorage();
  Object.entries(keys).forEach(([key, raw]) => storage.set(key, raw));
  return storage;
}

describe('createCoachmarkRepository', () => {
  it('은퇴한 안내의 키만 지운다', () => {
    // Given
    const storage = createStorageWith({
      'aido_coachmark_v1:user-1:ai-consent-notice': 'seen',
      'aido_coachmark_v1:user-1:voice-note-start': 'seen',
    });

    // When
    createCoachmarkRepository(storage).removeRetiredKeys();

    // Then
    expect(storage.keys()).toEqual(['aido_coachmark_v1:user-1:voice-note-start']);
  });

  it('탈퇴한 계정의 키만 지운다', () => {
    // Given
    const storage = createStorageWith({
      'aido_coachmark_v1:user-1:friend-strip': 'seen',
      'aido_coachmark_v1:user-1:voice-note-start': 'seen',
      'aido_coachmark_v1:user-10:friend-strip': 'seen',
    });

    // When
    createCoachmarkRepository(storage).clear('user-1');

    // Then
    expect(storage.keys()).toEqual(['aido_coachmark_v1:user-10:friend-strip']);
  });
});
