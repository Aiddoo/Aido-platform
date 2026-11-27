import { TODO_IMPORT_STATUSES } from '@aido/api/vocabulary';
import { toInstant } from '@src/shared/date/instant';

import { createTodoImport, IMPORT_ID } from '../__tests__/todo-import.fixtures';
import { rememberTodoImportId, TodoImportPolicy } from './todo-import.model';

const PREVIOUS_IMPORT_ID = 'clz7x5p8k0010qz0z8z8z8z8a';
const OLDEST_IMPORT_ID = 'clz7x5p8k0010qz0z8z8z8z8b';
const NEWEST_IMPORT_ID = 'clz7x5p8k0010qz0z8z8z8z8c';
const ACTIVE_STATUSES = new Set<string>(['UPLOADING', 'QUEUED', 'RUNNING', 'UNDOING']);

describe('TodoImportPolicy', () => {
  const NOW = toInstant('2026-11-24T03:00:00.000Z');

  describe('getStage', () => {
    it.each([
      { status: 'UPLOADING', failureReason: null, expected: 'processing' },
      { status: 'QUEUED', failureReason: null, expected: 'processing' },
      { status: 'RUNNING', failureReason: null, expected: 'processing' },
      { status: 'COMPLETED', failureReason: null, expected: 'finished' },
      { status: 'UNDOING', failureReason: null, expected: 'finished' },
      { status: 'UNDONE', failureReason: null, expected: 'finished' },
      { status: 'FAILED', failureReason: 'MATERIALIZATION_FAILED', expected: 'failed' },
      { status: 'FAILED', failureReason: 'STALLED', expected: 'failed' },
      { status: 'FAILED', failureReason: null, expected: 'failed' },
      { status: 'FAILED', failureReason: 'UNDO_FAILED', expected: 'undoFailed' },
      { status: 'CANCELED', failureReason: null, expected: 'stopped' },
      { status: 'ABANDONED', failureReason: null, expected: 'stopped' },
    ] as const)(
      '$status(실패 이유 $failureReason)는 $expected 단계다',
      ({ status, failureReason, expected }) => {
        // Given
        const todoImport = createTodoImport({ status, failureReason });

        // When
        const stage = TodoImportPolicy.getStage(todoImport);

        // Then
        expect(stage).toBe(expected);
      },
    );
  });

  describe('isTerminal', () => {
    it.each(TODO_IMPORT_STATUSES)('%s는 끝났거나 처리 중 둘 중 하나다', (status) => {
      // Given
      const todoImport = createTodoImport({ status });

      // When
      const isTerminal = TodoImportPolicy.isTerminal(todoImport);

      // Then
      expect(isTerminal).toBe(!ACTIVE_STATUSES.has(status));
    });
  });

  describe('canUndo', () => {
    // 되돌릴 수 있는지는 서버가 정해 기한(undoableUntil)으로만 알려 준다. 앱은 상태·수를 다시 보지 않는다
    it.each([
      ['완료이고 기한 전이면 되돌린다', 'COMPLETED', '2026-12-01T00:00:00.000Z', true],
      [
        '만들다 멈춰도 기한 전이면 만든 할 일을 되돌린다',
        'FAILED',
        '2026-12-01T00:00:00.000Z',
        true,
      ],
      ['기한이 지금이면 지났다', 'COMPLETED', '2026-11-24T03:00:00.000Z', false],
      ['기한이 없으면(모두 이미 가져온 일정·되돌리는 중) 되돌릴 수 없다', 'COMPLETED', null, false],
    ] as const)('%s', (_case, status, undoableUntil, expected) => {
      // Given
      const todoImport = createTodoImport({
        status,
        undoableUntil: undoableUntil == null ? null : toInstant(undoableUntil),
      });

      // When
      const canUndo = TodoImportPolicy.canUndo(todoImport, NOW);

      // Then
      expect(canUndo).toBe(expected);
    });
  });

  describe('canCancel', () => {
    it('업로드 중에만 멈출 수 있다', () => {
      // When
      const canCancelUploading = TodoImportPolicy.canCancel(
        createTodoImport({ status: 'UPLOADING' }),
      );
      const canCancelQueued = TodoImportPolicy.canCancel(createTodoImport({ status: 'QUEUED' }));

      // Then
      expect(canCancelUploading).toBe(true);
      expect(canCancelQueued).toBe(false);
    });
  });

  describe('canStop', () => {
    it.each([
      ['이 기기가 보내는 중이면 멈추지 못한다', 'UPLOADING', 'sending', false],
      ['이 기기의 업로드가 멈췄으면 멈출 수 있다', 'UPLOADING', 'paused', true],
      ['서버가 이 기기의 일정을 받지 않았으면 멈출 수 있다', 'UPLOADING', 'failed', true],
      ['다른 기기에서 시작한 업로드는 멈출 수 있다', 'UPLOADING', 'elsewhere', true],
      ['확정된 뒤에는 서버가 끝까지 만들어 멈추지 못한다', 'RUNNING', 'elsewhere', false],
    ] as const)('%s', (_case, status, deviceUpload, expected) => {
      // Given
      const todoImport = createTodoImport({ status });

      // When
      const canStop = TodoImportPolicy.canStop(todoImport, deviceUpload);

      // Then
      expect(canStop).toBe(expected);
    });
  });

  describe('calculateProcessedRatio', () => {
    it('처리 비율은 받은 수와 예상 수 중 큰 값 기준이고 0~1이다', () => {
      // Given
      const todoImport = createTodoImport({
        expectedItemCount: 200,
        receivedItemCount: 180,
        processedItemCount: 50,
      });

      // When
      const ratio = TodoImportPolicy.calculateProcessedRatio(todoImport);

      // Then
      expect(ratio).toBe(0.25);
      expect(
        TodoImportPolicy.calculateProcessedRatio(createTodoImport({ expectedItemCount: 0 })),
      ).toBe(0);
    });
  });
});

describe('rememberTodoImportId', () => {
  it.each([
    {
      scenario: '새 가져오기가 앞에 오고 앞의 가져오기는 뒤에 남아 다시 보일 수 있다',
      ids: [IMPORT_ID],
      expected: [PREVIOUS_IMPORT_ID, IMPORT_ID],
    },
    {
      scenario: '이미 있는 가져오기는 앞으로 옮기고 겹쳐 남기지 않는다',
      ids: [IMPORT_ID, PREVIOUS_IMPORT_ID],
      expected: [PREVIOUS_IMPORT_ID, IMPORT_ID],
    },
    {
      scenario: '세 개를 넘으면 가장 오래된 것을 뺀다',
      ids: [IMPORT_ID, OLDEST_IMPORT_ID, NEWEST_IMPORT_ID],
      expected: [PREVIOUS_IMPORT_ID, IMPORT_ID, OLDEST_IMPORT_ID],
    },
  ])('$scenario', ({ ids, expected }) => {
    // When
    const remembered = rememberTodoImportId(ids, PREVIOUS_IMPORT_ID);

    // Then
    expect(remembered).toEqual(expected);
  });
});
