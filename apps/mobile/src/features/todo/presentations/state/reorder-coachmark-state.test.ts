import type { SyncStorage } from '@src/core/ports/sync-storage';
import { claimReorderCoachmark } from './reorder-coachmark-state';

function createMemoryStorage(): SyncStorage {
  const values = new Map<string, string>();
  return {
    getString: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    delete: (key) => values.delete(key),
  };
}

describe('claimReorderCoachmark', () => {
  it('계정별 코치마크를 종류마다 최초 한 번만 claim한다', () => {
    // Given
    const storage = createMemoryStorage();

    // When
    const firstTodo = claimReorderCoachmark(storage, {
      accountId: 'account-1',
      kind: 'todo',
    });
    const duplicateTodo = claimReorderCoachmark(storage, {
      accountId: 'account-1',
      kind: 'todo',
    });
    const category = claimReorderCoachmark(storage, {
      accountId: 'account-1',
      kind: 'category',
    });
    const anotherAccount = claimReorderCoachmark(storage, {
      accountId: 'account-2',
      kind: 'todo',
    });

    // Then
    expect(firstTodo).toBe(true);
    expect(duplicateTodo).toBe(false);
    expect(category).toBe(true);
    expect(anotherAccount).toBe(true);
  });
});
