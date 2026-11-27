import { createTodoImport } from '../__tests__/todo-import.fixtures';
import { toTodoImportOutcome } from './todo-import-analytics';

describe('toTodoImportOutcome', () => {
  it.each([
    { status: 'COMPLETED', failureReason: null, expected: 'completed' },
    { status: 'FAILED', failureReason: 'MATERIALIZATION_FAILED', expected: 'server_failed' },
    { status: 'FAILED', failureReason: 'STALLED', expected: 'server_failed' },
    { status: 'FAILED', failureReason: null, expected: 'server_failed' },
    { status: 'FAILED', failureReason: 'UNDO_FAILED', expected: null },
    { status: 'CANCELED', failureReason: null, expected: 'canceled' },
    { status: 'ABANDONED', failureReason: null, expected: 'abandoned' },
    { status: 'UPLOADING', failureReason: null, expected: null },
    { status: 'QUEUED', failureReason: null, expected: null },
    { status: 'RUNNING', failureReason: null, expected: null },
    { status: 'UNDOING', failureReason: null, expected: null },
    { status: 'UNDONE', failureReason: null, expected: null },
  ] as const)(
    '$status(실패 이유 $failureReason)의 결과는 $expected다',
    ({ status, failureReason, expected }) => {
      // Given
      const todoImport = createTodoImport({ status, failureReason });

      // When
      const outcome = toTodoImportOutcome(todoImport);

      // Then
      expect(outcome).toBe(expected);
    },
  );
});
