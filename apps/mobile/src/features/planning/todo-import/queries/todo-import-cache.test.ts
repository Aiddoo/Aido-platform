import { TODO_QUERY_KEYS } from '@src/features/planning/todo/queries/todo-query-keys';
import { createTestQueryClient } from '@src/testing/core';

import { createTodoImport } from '../__tests__/todo-import.fixtures';
import { settleTodoImportFinished } from './todo-import-cache';

describe('settleTodoImportFinished', () => {
  it.each([
    ['처음 보는 가져오기(이전 값 없음)', null, 'COMPLETED', false],
    ['아직 처리 중', 'QUEUED', 'RUNNING', false],
    ['처리 중에서 처음 끝남', 'RUNNING', 'COMPLETED', true],
    ['되돌리기가 처음 끝남', 'UNDOING', 'UNDONE', true],
    ['이미 끝난 뒤 다시 받음', 'COMPLETED', 'COMPLETED', false],
  ] as const)('%s', async (_case, previousStatus, nextStatus, shouldRefresh) => {
    // Given
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(TODO_QUERY_KEYS.lists(), []);

    // When
    await settleTodoImportFinished(queryClient, {
      previous: previousStatus == null ? null : createTodoImport({ status: previousStatus }),
      next: createTodoImport({ status: nextStatus }),
    });

    // Then
    expect(queryClient.getQueryState(TODO_QUERY_KEYS.lists())?.isInvalidated).toBe(shouldRefresh);
  });
});
