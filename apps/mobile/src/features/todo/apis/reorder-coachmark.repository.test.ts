import type { SyncStorage } from '@src/core/ports/sync-storage';

import { createReorderCoachmarkRepository } from './reorder-coachmark.repository';

function createMemoryStorage(): SyncStorage {
  const values = new Map<string, string>();
  return {
    getString: (key) => values.get(key),
    set: (key, value) => values.set(key, value),
    delete: (key) => values.delete(key),
  };
}

describe('ReorderCoachmarkRepository', () => {
  it('계정별 코치마크를 종류마다 최초 한 번만 claim한다', () => {
    // Given
    const repository = createReorderCoachmarkRepository(createMemoryStorage());

    // When
    const firstTodo = repository.claim({ accountId: 'account-1', kind: 'todo' });
    const duplicateTodo = repository.claim({ accountId: 'account-1', kind: 'todo' });
    const category = repository.claim({ accountId: 'account-1', kind: 'category' });
    const anotherAccount = repository.claim({ accountId: 'account-2', kind: 'todo' });

    // Then
    expect(firstTodo).toBe(true);
    expect(duplicateTodo).toBe(false);
    expect(category).toBe(true);
    expect(anotherAccount).toBe(true);
  });
});
