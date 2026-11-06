import { toHHmm } from '@src/shared/date/instant';
import { getDeviceTimezone } from '@src/shared/infra/device-clock';

import {
  createDailyCompletionsDto,
  createTodoDto,
  createTodoItemResponseDto,
} from '../__tests__/todo.fixtures';
import { toDailyCompletionsResult, toTodo } from './todo.mapper';

jest.useFakeTimers({ now: new Date('2026-03-08T00:00:00.000Z') });

describe('toTodo', () => {
  test('서버 벽시계를 시간대와 상관없이 그대로 읽고 직렬화할 수 있다', () => {
    // Given
    const dto = createTodoDto({
      scheduledTime: '2026-03-08T01:00:00.000Z',
      scheduledLocalTime: '10:00',
    });

    // When
    const result = toTodo(dto);

    // Then
    expect(result.localTime).toBe('10:00');
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    expect(result.id).toBe(dto.id);
    expect(result.title).toBe(dto.title);
  });

  test('옛 서버 응답(칸 없음)은 순간을 기기 시간대로 읽는다', () => {
    // Given
    const instant = '2026-03-08T01:00:00.000Z';
    const dto = createTodoDto({ scheduledTime: instant, scheduledLocalTime: undefined });

    // When
    const result = toTodo(dto);

    // Then
    expect(result.localTime).toBe(toHHmm(new Date(instant), getDeviceTimezone()));
  });

  test('칸이 비어 있어도(재배포 전 옛 서버가 쓴 행) 순간을 기기 시간대로 읽는다', () => {
    // Given
    const instant = '2026-03-08T01:00:00.000Z';
    const dto = createTodoDto({ scheduledTime: instant, scheduledLocalTime: null });

    // When
    const result = toTodo(dto);

    // Then
    expect(result.localTime).toBe(toHHmm(new Date(instant), getDeviceTimezone()));
  });

  test('시간 없는 할 일은 낡은 칸이 있어도 null이다', () => {
    // Given
    const dto = createTodoDto({ scheduledTime: null, scheduledLocalTime: '10:00' });

    // When
    const result = toTodo(dto);

    // Then
    expect(result.localTime).toBeNull();
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
