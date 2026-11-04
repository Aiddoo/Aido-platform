import type { SyncStorage } from '@src/core/ports/sync-storage';

import { coachmarkStorageKey, createCoachmarkRepository } from './coachmark.repository';
import { CoachmarkService } from './coachmark.service';

function createMemoryStorage(initial: Record<string, string> = {}): SyncStorage {
  const values = new Map(Object.entries(initial));
  return {
    getString: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    delete: (key) => values.delete(key),
  };
}

describe('CoachmarkService', () => {
  it('보이는 순간 끝나는 안내는 계정·종류마다 처음 한 번만 claim한다', () => {
    // Given
    const service = new CoachmarkService(createCoachmarkRepository(createMemoryStorage()));

    // When
    const first = service.claim({ accountId: 'account-1', kind: 'todo-reorder' });
    const duplicate = service.claim({ accountId: 'account-1', kind: 'todo-reorder' });
    const category = service.claim({ accountId: 'account-1', kind: 'category-reorder' });
    const anotherAccount = service.claim({ accountId: 'account-2', kind: 'todo-reorder' });

    // Then
    expect([first, duplicate, category, anotherAccount]).toEqual([true, false, true, true]);
  });

  it('1.14.0 이하에서 본 재정렬 안내는 예전 키로 읽어 다시 보이지 않는다', () => {
    // Given
    const storage = createMemoryStorage({
      'aido_reorder_coachmark_v1:account-1:todo': '2026-10-01T00:00:00.000Z',
    });
    const service = new CoachmarkService(createCoachmarkRepository(storage));

    // When
    const claimed = service.claim({ accountId: 'account-1', kind: 'todo-reorder' });

    // Then
    expect(claimed).toBe(false);
  });

  it('더블탭 안내는 쓰거나 닫기 전까지 남아 있다', () => {
    // Given
    const service = new CoachmarkService(createCoachmarkRepository(createMemoryStorage()));
    const input = { accountId: 'account-1', kind: 'comment-double-tap' } as const;

    // When
    const beforeUse = [service.isPending(input), service.isPending(input)];
    service.complete(input);

    // Then
    expect(beforeUse).toEqual([true, true]);
    expect(service.isPending(input)).toBe(false);
    expect(coachmarkStorageKey(input)).toBe('aido_coachmark_v1:account-1:comment-double-tap');
  });

  it('음성 안내는 기존 키 규칙으로 종류마다 따로 저장한다', () => {
    // Given
    const kinds = ['voice-quick-start', 'voice-note-start', 'voice-key-point'] as const;

    // When
    const keys = kinds.map((kind) => coachmarkStorageKey({ accountId: 'account-1', kind }));

    // Then
    expect(keys).toEqual([
      'aido_coachmark_v1:account-1:voice-quick-start',
      'aido_coachmark_v1:account-1:voice-note-start',
      'aido_coachmark_v1:account-1:voice-key-point',
    ]);
  });
});
