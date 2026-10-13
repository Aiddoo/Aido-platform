import {
  createAiUsageResponseDto,
  createDailyCompletionsDto,
  createParseTodoResponseDto,
  createTodoDto,
  createTodoItemResponseDto,
} from '../__tests__/todo.factories';
import {
  toAiUsage,
  toDailyCompletionsResult,
  toParsedTodoResult,
  toTodoItem,
  toTodoItems,
} from './todo.mapper';

jest.useFakeTimers({ now: new Date('2026-03-08T00:00:00.000Z') });

describe('toTodoItem', () => {
  test('scheduledTime ISO → Date 변환', () => {
    // Given
    const dto = createTodoDto({ scheduledTime: '2026-03-08T09:00:00.000Z' });

    // When
    const result = toTodoItem(dto);

    // Then
    expect(result.scheduledTime).toBeInstanceOf(Date);
    expect(result.scheduledTime?.toISOString()).toBe('2026-03-08T09:00:00.000Z');
    expect(result.id).toBe(dto.id);
    expect(result.title).toBe(dto.title);
  });

  test('scheduledTime null → null', () => {
    // Given
    const dto = createTodoDto({ scheduledTime: null });

    // When
    const result = toTodoItem(dto);

    // Then
    expect(result.scheduledTime).toBeNull();
  });

  test('isAllDay, completed, visibility 매핑', () => {
    // Given
    const dto = createTodoDto({ isAllDay: true, completed: true, visibility: 'PRIVATE' });

    // When
    const result = toTodoItem(dto);

    // Then
    expect(result.isAllDay).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.visibility).toBe('PRIVATE');
  });
});

describe('toTodoItem — subTodos/subTodoStats', () => {
  test('subTodos 배열 매핑', () => {
    // Given
    const dto = createTodoDto({
      items: [
        createTodoItemResponseDto({ id: 1, title: '항목 1' }),
        createTodoItemResponseDto({ id: 2, title: '항목 2', completed: true }),
      ],
      itemStats: { total: 2, completed: 1 },
    });

    // When
    const result = toTodoItem(dto);

    // Then
    expect(result.subTodos).toHaveLength(2);
    expect(result.subTodos[0]?.title).toBe('항목 1');
    expect(result.subTodos[1]?.completed).toBe(true);
    expect(result.subTodoStats).toEqual({ total: 2, completed: 1 });
  });

  test('빈 subTodos → 빈 배열 + zero stats', () => {
    // Given
    const dto = createTodoDto({ items: [], itemStats: { total: 0, completed: 0 } });

    // When
    const result = toTodoItem(dto);

    // Then
    expect(result.subTodos).toEqual([]);
    expect(result.subTodoStats).toEqual({ total: 0, completed: 0 });
  });
});

describe('toTodoItems', () => {
  test('배열 변환', () => {
    // Given
    const dtos = [createTodoDto({ id: 1 }), createTodoDto({ id: 2 })];

    // When
    const result = toTodoItems(dtos);

    // Then
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(1);
    expect(result[1]?.id).toBe(2);
  });

  test('빈 배열 → 빈 배열', () => {
    // When
    const result = toTodoItems([]);

    // Then
    expect(result).toEqual([]);
  });
});

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

describe('toAiUsage', () => {
  test('data 추출', () => {
    // Given
    const dto = createAiUsageResponseDto();

    // When
    const result = toAiUsage(dto);

    // Then
    expect(result).toEqual({
      used: 3,
      limit: 10,
      resetsAt: '2026-03-09T00:00:00.000Z',
    });
  });
});

describe('toDailyCompletionsResult', () => {
  test('completions 배열 + totalCompleteDays', () => {
    // Given
    const dto = createDailyCompletionsDto();

    // When
    const result = toDailyCompletionsResult(dto);

    // Then
    expect(result.completions).toHaveLength(1);
    expect(result.completions[0]?.date).toBe('2026-03-01');
    expect(result.totalCompleteDays).toBe(1);
    expect(result.dateRange.startDate).toBe('2026-03-01');
  });
});
