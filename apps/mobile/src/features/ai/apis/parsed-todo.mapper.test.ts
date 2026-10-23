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
});
