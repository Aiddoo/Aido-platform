import { TODO_IMPORT_STATUSES } from '@aido/api/vocabulary';
import { createTestDi } from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';

import { createTodoImport, IMPORT_ID } from '../__tests__/todo-import.fixtures';
import { TodoImportPolicy } from '../domains/todo-import.model';
import { TODO_IMPORT_QUERY_KEYS } from './todo-import-query-keys';
import { useGetTodoImportQueryOptions } from './todo-import.queries';

describe('useGetTodoImportQueryOptions', () => {
  it.each(TODO_IMPORT_STATUSES)('%s: 끝난 상태에서만 다시 묻기를 멈춘다', async (status) => {
    // Given
    const di = createTestDi();
    const todoImport = createTodoImport({ status });
    di.queryClient.setQueryData(TODO_IMPORT_QUERY_KEYS.detail({ importId: IMPORT_ID }), todoImport);
    const { result } = await renderScreenHook(
      () => useGetTodoImportQueryOptions({ importId: IMPORT_ID }),
      { di },
    );
    const { refetchInterval } = result.current;
    const query = di.queryClient.getQueryCache().build(di.queryClient, result.current);

    // When
    const intervalMs = typeof refetchInterval === 'function' ? refetchInterval(query) : null;

    // Then
    expect(intervalMs === false).toBe(TodoImportPolicy.isTerminal(todoImport));
    expect(intervalMs).not.toBeNull();
  });
});
