import {
  createDailyCompletionsDto,
  createTodoDto,
  createTodoItemResponseDto,
} from '../__tests__/todo.factories';
import { toDailyCompletionsResult, toTodo, toTodos } from './todo.mapper';

jest.useFakeTimers({ now: new Date('2026-03-08T00:00:00.000Z') });

describe('toTodo', () => {
  test('scheduledTime ISO → 직렬화 가능한 timestamp 변환', () => {
    // Given
    const dto = createTodoDto({ scheduledTime: '2026-03-08T09:00:00.000Z' });

    // When
    const result = toTodo(dto);

    // Then
    expect(result.scheduledAtMs).toBe(Date.parse('2026-03-08T09:00:00.000Z'));
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(result.id).toBe(dto.id);
    expect(result.title).toBe(dto.title);
  });

  test('scheduledTime null → null', () => {
    // Given
    const dto = createTodoDto({ scheduledTime: null });

    // When
    const result = toTodo(dto);

    // Then
    expect(result.scheduledAtMs).toBeNull();
  });

  test('isAllDay, completed, visibility 매핑', () => {
    // Given
    const dto = createTodoDto({ isAllDay: true, completed: true, visibility: 'PRIVATE' });

    // When
    const result = toTodo(dto);

    // Then
    expect(result.isAllDay).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.visibility).toBe('PRIVATE');
  });
});

describe('toTodo — subTodos/subTodoStats', () => {
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
    const result = toTodo(dto);

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
    const result = toTodo(dto);

    // Then
    expect(result.subTodos).toEqual([]);
    expect(result.subTodoStats).toEqual({ total: 0, completed: 0 });
  });
});

describe('toTodos', () => {
  test('배열 변환', () => {
    // Given
    const dtos = [createTodoDto({ id: 1 }), createTodoDto({ id: 2 })];

    // When
    const result = toTodos(dtos);

    // Then
    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(1);
    expect(result[1]?.id).toBe(2);
  });

  test('빈 배열 → 빈 배열', () => {
    // When
    const result = toTodos([]);

    // Then
    expect(result).toEqual([]);
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

describe('toTodo의 반복 규칙', () => {
  test('소유자 응답의 규칙을 앱 모델로 옮긴다', () => {
    // Given
    const dto = createTodoDto({
      recurrenceGroupId: 'series-1',
      repeat: { frequency: 'WEEKLY', interval: 2, weekdays: ['TUE'], end: { type: 'NEVER' } },
    });

    // When
    const todo = toTodo(dto);

    // Then
    expect(todo.repeat).toEqual({
      frequency: 'WEEKLY',
      interval: 2,
      weekdays: ['TUE'],
      end: { type: 'NEVER' },
    });
  });

  test('구 서버·친구 응답처럼 키가 없으면 규칙은 null이다', () => {
    // Given
    const { repeat: _repeat, ...dto } = createTodoDto({ recurrenceGroupId: 'series-1' });

    // When
    const todo = toTodo(dto);

    // Then
    expect(todo.repeat).toBeNull();
    expect(todo.recurrenceGroupId).toBe('series-1');
  });
});
