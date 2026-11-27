import { createTodoImportSelection } from '../__tests__/todo-import.fixtures';
import { createTodoImportSession, TodoImportSessionPolicy } from './todo-import-session.model';

describe('TodoImportSessionPolicy', () => {
  describe('withChunks', () => {
    it('다시 읽은 일정이 같으면 끊긴 묶음부터, 달라졌으면 처음부터 보낸다', () => {
      // Given
      const session = TodoImportSessionPolicy.withUploadedChunk(
        TodoImportSessionPolicy.withChunks(
          createTodoImportSession({
            idempotencyKey: 'key',
            selection: createTodoImportSelection(),
            hasAdjustedRange: false,
          }),
          { fingerprint: '250:abc', chunkCount: 3 },
        ),
        1,
      );

      // When
      const same = TodoImportSessionPolicy.withChunks(session, {
        fingerprint: '250:abc',
        chunkCount: 3,
      });
      const changed = TodoImportSessionPolicy.withChunks(session, {
        fingerprint: '251:def',
        chunkCount: 3,
      });

      // Then
      expect(same.nextChunkIndex).toBe(2);
      expect(changed.nextChunkIndex).toBe(0);
      expect(TodoImportSessionPolicy.hasFingerprintChanged(session, '251:def')).toBe(true);
    });
  });
});
