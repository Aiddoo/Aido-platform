import { getNowInstant } from '@src/shared/date/clock';
import { createMemorySyncStorage } from '@src/testing/core';

import { createCoachmarkKey, createCoachmarkRepository } from './coachmark.repository';

describe('createCoachmarkRepository', () => {
  it('친구 찾기 안내를 이미 닫은 사람은 옛 키 그대로 본 것으로 읽는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set('aido_friend_strip_hint_dismissed_v1:user-1', '2026-10-01T00:00:00.000Z');

    // When
    const repository = createCoachmarkRepository(storage, getNowInstant);

    // Then
    expect(repository.hasSeen({ accountId: 'user-1', kind: 'friend-strip' })).toBe(true);
    expect(repository.hasSeen({ accountId: 'user-2', kind: 'friend-strip' })).toBe(false);
  });

  it('저장 키는 출시된 앱과 같다', () => {
    // When·Then
    expect(createCoachmarkKey({ accountId: 'u', kind: 'todo-reorder' })).toBe(
      'aido_reorder_coachmark_v1:u:todo',
    );
    expect(createCoachmarkKey({ accountId: 'u', kind: 'friend-strip' })).toBe(
      'aido_friend_strip_hint_dismissed_v1:u',
    );
    expect(createCoachmarkKey({ accountId: 'u', kind: 'voice-note-start' })).toBe(
      'aido_coachmark_v1:u:voice-note-start',
    );
  });

  it('은퇴한 안내의 키만 지운다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set('aido_coachmark_v1:user-1:ai-consent-notice', 'seen');
    storage.set('aido_coachmark_v1:user-1:voice-note-start', 'seen');
    storage.set('aido_reorder_coachmark_v1:user-1:todo', 'seen');

    // When
    createCoachmarkRepository(storage, getNowInstant).removeRetiredKeys();

    // Then
    expect(storage.keys().sort()).toEqual([
      'aido_coachmark_v1:user-1:voice-note-start',
      'aido_reorder_coachmark_v1:user-1:todo',
    ]);
  });

  it('탈퇴한 계정의 키만 지운다', () => {
    // Given
    const storage = createMemorySyncStorage();
    const repository = createCoachmarkRepository(storage, getNowInstant);
    repository.markSeen({ accountId: 'user-1', kind: 'friend-strip' });
    repository.markSeen({ accountId: 'user-1', kind: 'todo-reorder' });
    repository.markSeen({ accountId: 'user-1', kind: 'voice-note-start' });
    repository.markSeen({ accountId: 'user-10', kind: 'friend-strip' });

    // When
    repository.clear('user-1');

    // Then
    expect(storage.keys()).toEqual(['aido_friend_strip_hint_dismissed_v1:user-10']);
  });
});
