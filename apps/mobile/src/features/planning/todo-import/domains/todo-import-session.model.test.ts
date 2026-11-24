import { dateKeySchema } from '@src/shared/date/date-key';

import { createTodoImportSelection } from '../__tests__/todo-import.fixtures';
import {
  adjustSelectionToToday,
  createTodoImportSession,
  getRetryDelayMs,
  TodoImportSessionPolicy,
} from './todo-import-session.model';

describe('getRetryDelayMs', () => {
  it.each([
    ['첫 재시도는 1초 안에서 고른다', 0, null, 0.5, 500],
    ['시도마다 상한이 두 배다', 3, null, 0.5, 4000],
    ['상한은 60초를 넘지 않는다', 10, null, 0.999, 59_940],
    ['Retry-After보다 짧지 않다', 0, 30_000, 0.1, 30_000],
    ['난수가 0이어도 Retry-After만큼 기다린다', 5, 2000, 0, 2000],
  ])('%s', (_case, attempt, retryAfterMs, randomValue, expected) => {
    // When
    const delayMs = getRetryDelayMs({ attempt, retryAfterMs, random: () => randomValue });

    // Then
    expect(delayMs).toBe(expected);
  });
});

describe('adjustSelectionToToday', () => {
  it('기기 오늘이 넘어갔으면 오늘부터 같은 마지막 날까지로 맞춘다', () => {
    // Given
    const selection = createTodoImportSelection();

    // When
    const adjusted = adjustSelectionToToday(selection, dateKeySchema.parse('2026-11-25'));

    // Then
    expect(adjusted).toMatchObject({ startDate: '2026-11-25', endDate: '2026-12-23' });
  });

  it('기기 오늘이 그대로면 맞출 수 없다', () => {
    // When
    const adjusted = adjustSelectionToToday(
      createTodoImportSelection(),
      dateKeySchema.parse('2026-11-24'),
    );

    // Then
    expect(adjusted).toBeNull();
  });
});

describe('TodoImportSessionPolicy', () => {
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
