import { TODO_IMPORT_STATUSES } from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { toInstant } from '@src/shared/date/instant';

import { createTodoImport } from '../__tests__/todo-import.fixtures';
import { IMPORT_RANGE_PRESETS } from '../constants/todo-import.constants';
import { canImportUntil, getRangeEndDate, TodoImportPolicy } from './todo-import.model';

const TODAY = dateKeySchema.parse('2026-11-24');
const FREE_HORIZON_DAYS = 30;

describe('getRangeEndDate', () => {
  it.each([
    ['1주는 오늘 포함 7일째', IMPORT_RANGE_PRESETS.week, '2026-11-30'],
    ['1개월은 30일이라 31일짜리 달에도 무료 기간 안이다', IMPORT_RANGE_PRESETS.month, '2026-12-23'],
    ['1년은 365일째', IMPORT_RANGE_PRESETS.year, '2027-11-23'],
  ])('%s', (_case, days, expected) => {
    // When
    const endDate = getRangeEndDate(TODAY, days);

    // Then
    expect(endDate).toBe(expected);
  });
});

describe('canImportUntil', () => {
  it.each([
    ['무료 30일의 마지막 날은 된다', '2026-12-23', FREE_HORIZON_DAYS, true],
    ['무료 31일째는 안 된다', '2026-12-24', FREE_HORIZON_DAYS, false],
    ['오늘 이전은 안 된다', '2026-11-23', FREE_HORIZON_DAYS, false],
    ['기간 제한이 없으면(관리자) 먼 날도 된다', '2028-01-01', null, true],
  ])('%s', (_case, endDate, horizonDays, expected) => {
    // When
    const canImport = canImportUntil(dateKeySchema.parse(endDate), TODAY, horizonDays);

    // Then
    expect(canImport).toBe(expected);
  });
});

describe('TodoImportPolicy', () => {
  const NOW = toInstant('2026-11-24T03:00:00.000Z');

  it.each(TODO_IMPORT_STATUSES)(
    '%s는 끝났거나 처리 중 둘 중 하나이고 끝나면 묻지 않는다',
    (status) => {
      // Given
      const todoImport = createTodoImport({ status });

      // When
      const isTerminal = TodoImportPolicy.isTerminal(todoImport);
      const pollIntervalMs = TodoImportPolicy.getPollIntervalMs(todoImport);

      // Then
      expect(pollIntervalMs === false).toBe(isTerminal);
    },
  );

  it.each([
    ['완료이고 기한 전이면 되돌린다', 'COMPLETED', '2026-12-01T00:00:00.000Z', true],
    ['기한이 지금이면 지났다', 'COMPLETED', '2026-11-24T03:00:00.000Z', false],
    ['기한이 없으면 되돌릴 수 없다', 'COMPLETED', null, false],
    ['이미 되돌리는 중이면 다시 하지 않는다', 'UNDOING', '2026-12-01T00:00:00.000Z', false],
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
