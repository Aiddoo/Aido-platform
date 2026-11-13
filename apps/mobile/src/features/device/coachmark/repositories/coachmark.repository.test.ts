import { readStoredValue } from '@src/shared/storage/define-stored-value';
import { createMemorySyncStorage } from '@src/testing/core';

import { CoachmarkPolicy } from '../domains/coachmark.model';
import { coachmarkCompletedAtStoredValue } from '../schemas/coachmark-storage.schema';
import { createCoachmarkRepository } from './coachmark.repository';

/** 1.14.0·1.15.1 기기에 남은 실제 키와 원문(`new Date().toISOString()`·`getNowInstant()`) */
const RELEASED_KEYS = {
  'aido_reorder_coachmark_v1:cef900c707edd81590a094dc3:todo': '2026-08-14T09:12:30.512Z',
  'aido_reorder_coachmark_v1:cef900c707edd81590a094dc3:category': '2026-08-14T09:13:02.004Z',
  'aido_friend_strip_hint_dismissed_v1:cef900c707edd81590a094dc3': '2026-10-21T23:40:11.873Z',
  'aido_coachmark_v1:cef900c707edd81590a094dc3:voice-note-start': '2026-11-02T11:05:44.120Z',
} as const;
const ACCOUNT_ID = 'cef900c707edd81590a094dc3';

function createReleasedStorage(keys: Readonly<Record<string, string>> = RELEASED_KEYS) {
  const storage = createMemorySyncStorage();
  Object.entries(keys).forEach(([key, raw]) => storage.set(key, raw));
  return storage;
}

describe('createCoachmarkRepository', () => {
  describe('migrateLegacyKeys', () => {
    it('옛 재정렬·친구 줄 키의 원문을 새 키로 옮기고 옛 키를 지운다', () => {
      // Given
      const storage = createReleasedStorage();

      // When
      createCoachmarkRepository(storage).migrateLegacyKeys();

      // Then
      expect(
        Object.fromEntries(
          storage
            .keys()
            .sort()
            .map((key) => [key, storage.get(key)]),
        ),
      ).toEqual({
        'aido_coachmark_v1:cef900c707edd81590a094dc3:category-reorder': '2026-08-14T09:13:02.004Z',
        'aido_coachmark_v1:cef900c707edd81590a094dc3:friend-strip': '2026-10-21T23:40:11.873Z',
        'aido_coachmark_v1:cef900c707edd81590a094dc3:todo-reorder': '2026-08-14T09:12:30.512Z',
        'aido_coachmark_v1:cef900c707edd81590a094dc3:voice-note-start': '2026-11-02T11:05:44.120Z',
      });
    });

    it('옮긴 뒤 이미 본 안내는 다시 띄우지 않는다', () => {
      // Given
      const storage = createReleasedStorage();

      // When
      createCoachmarkRepository(storage).migrateLegacyKeys();

      // Then
      const kinds = ['todo-reorder', 'category-reorder', 'friend-strip'] as const;
      kinds.forEach((kind) => {
        const completedAt = readStoredValue(storage, coachmarkCompletedAtStoredValue, {
          accountId: ACCOUNT_ID,
          kind,
        });
        expect(CoachmarkPolicy.shouldShow({ kind, completedAt })).toBe(false);
      });
    });

    it('새 키가 이미 있으면 그 기록을 두고 옛 키만 지운다', () => {
      // Given
      const storage = createReleasedStorage({
        'aido_friend_strip_hint_dismissed_v1:user-1': '2026-08-01T00:00:00.000Z',
        'aido_coachmark_v1:user-1:friend-strip': '2026-07-01T00:00:00.000Z',
      });

      // When
      createCoachmarkRepository(storage).migrateLegacyKeys();

      // Then
      expect(storage.keys()).toEqual(['aido_coachmark_v1:user-1:friend-strip']);
      expect(storage.get('aido_coachmark_v1:user-1:friend-strip')).toBe('2026-07-01T00:00:00.000Z');
    });

    it('두 번 불러도 결과가 같고 다른 키와 모르는 옛 모양은 건드리지 않는다', () => {
      // Given
      const storage = createReleasedStorage({
        'aido_reorder_coachmark_v1:user-1:todo': '2026-08-01T00:00:00.000Z',
        'aido_reorder_coachmark_v1:user-1:memo': '2026-08-01T00:00:00.000Z',
        aido_invite_pending_v1: '{}',
      });
      const repository = createCoachmarkRepository(storage);

      // When
      repository.migrateLegacyKeys();
      repository.migrateLegacyKeys();

      // Then
      expect(storage.keys().sort()).toEqual([
        'aido_coachmark_v1:user-1:todo-reorder',
        'aido_invite_pending_v1',
        'aido_reorder_coachmark_v1:user-1:memo',
      ]);
    });

    it('새 키를 쓰지 못하면 옛 키를 남겨 다음 시작 때 다시 옮긴다', () => {
      // Given
      const storage = createReleasedStorage({
        'aido_reorder_coachmark_v1:user-1:todo': '2026-08-01T00:00:00.000Z',
      });
      storage.set.mockImplementationOnce(() => {
        throw new Error('mmkv unavailable');
      });

      // When
      const migrate = () => createCoachmarkRepository(storage).migrateLegacyKeys();

      // Then
      expect(migrate).toThrow('mmkv unavailable');
      expect(storage.keys()).toEqual(['aido_reorder_coachmark_v1:user-1:todo']);
    });
  });

  it('은퇴한 안내의 키만 지운다', () => {
    // Given
    const storage = createReleasedStorage({
      'aido_coachmark_v1:user-1:ai-consent-notice': 'seen',
      'aido_coachmark_v1:user-1:voice-note-start': 'seen',
    });

    // When
    createCoachmarkRepository(storage).removeRetiredKeys();

    // Then
    expect(storage.keys()).toEqual(['aido_coachmark_v1:user-1:voice-note-start']);
  });

  it('탈퇴한 계정의 새 키와 옮기지 못한 옛 키를 지운다', () => {
    // Given
    const storage = createReleasedStorage({
      'aido_coachmark_v1:user-1:friend-strip': 'seen',
      'aido_coachmark_v1:user-1:voice-note-start': 'seen',
      'aido_reorder_coachmark_v1:user-1:todo': 'seen',
      'aido_friend_strip_hint_dismissed_v1:user-1': 'seen',
      'aido_coachmark_v1:user-10:friend-strip': 'seen',
      'aido_friend_strip_hint_dismissed_v1:user-10': 'seen',
    });

    // When
    createCoachmarkRepository(storage).clear('user-1');

    // Then
    expect(storage.keys().sort()).toEqual([
      'aido_coachmark_v1:user-10:friend-strip',
      'aido_friend_strip_hint_dismissed_v1:user-10',
    ]);
  });
});
