import { formatDate } from '@src/shared/utils/date';

import { createParseTodoResponseDto } from '../__tests__/parsed-todo.factories';
import { toParsedTodoResult } from './parsed-todo.mapper';

jest.useFakeTimers({ now: new Date('2026-03-08T00:00:00.000Z') });

describe('toParsedTodoResult', () => {
  test('startDate ISO → Date, recurrence null', () => {
    // Given
    const dto = createParseTodoResponseDto();

    // When
    const result = toParsedTodoResult(dto);

    // Then
    expect(result.data.startDate).toBeInstanceOf(Date);
    expect(result.data.recurrence).toBeNull();
    expect(result.data.categoryId).toBe(1);
    expect(result.meta.model).toBe('gpt-4');
  });

  test('recurrence 있는 경우 endDate → Date 변환', () => {
    // Given
    const dto = createParseTodoResponseDto({
      data: {
        ...createParseTodoResponseDto().data,
        isRecurring: true,
        recurrence: {
          daysOfWeek: ['MON', 'WED', 'FRI'],
          endDate: '2026-06-30',
        },
      },
    });

    // When
    const result = toParsedTodoResult(dto);

    // Then
    expect(result.data.recurrence).not.toBeNull();
    expect(result.data.recurrence?.endDate).toBeInstanceOf(Date);
    expect(result.data.recurrence?.daysOfWeek).toEqual(['MON', 'WED', 'FRI']);
  });

  test('categoryId 없는 경우 제외', () => {
    // Given
    const dto = createParseTodoResponseDto({
      data: {
        ...createParseTodoResponseDto().data,
        categoryId: undefined,
      },
    });

    // When
    const result = toParsedTodoResult(dto);

    // Then
    expect(result.data).not.toHaveProperty('categoryId');
  });

  test('서버 날짜를 기기 로컬 날짜로 읽어 시간대와 무관하게 같은 날짜를 유지한다', () => {
    // Given - UTC 자정으로 읽으면 UTC 음수 시간대에서 하루 앞당겨지는 날짜들
    const dto = createParseTodoResponseDto({
      data: {
        ...createParseTodoResponseDto().data,
        startDate: '2026-10-29',
        endDate: '2026-10-31',
        isRecurring: true,
        recurrence: { daysOfWeek: ['THU'], endDate: '2026-11-26' },
      },
    });

    // When
    const result = toParsedTodoResult(dto);

    // Then - 로컬 달력 날짜가 서버 문자열과 같다
    expect(formatDate(result.data.startDate)).toBe('2026-10-29');
    expect(result.data.endDate == null ? null : formatDate(result.data.endDate)).toBe('2026-10-31');
    expect(result.data.recurrence == null ? null : formatDate(result.data.recurrence.endDate)).toBe(
      '2026-11-26',
    );
    expect(result.data.startDate.getHours()).toBe(0);
  });
});
