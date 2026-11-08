import { dailyCompletionsRangeResponseSchema, todoListResponseSchema } from '@aido/api';
import { setupFakeTimersPerTest } from '@src/shared/__tests__/setup-fake-timers-per-test';

import {
  createDailyCompletionsDto,
  createTodoDto,
  createTodoItemResponseDto,
  createTodoListResponseDto,
} from '../__tests__/todo.fixtures';
import { dailyCompletionsResultSchema, todoListResultSchema } from '../schemas/todo.schema';
import { toDailyCompletionsResult, toTodo, toTodoListResult } from './todo.mapper';

setupFakeTimersPerTest({ now: new Date('2026-03-08T00:00:00.000Z') });

describe('toTodo', () => {
  it('서버 벽시계를 시간대와 상관없이 그대로 읽고 직렬화할 수 있다', () => {
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

  it('칸이 비어 있는 시간 행은 순간만 보관한다', () => {
    // Given
    const instant = '2026-03-08T01:00:00.000Z';
    const dto = createTodoDto({ scheduledTime: instant, scheduledLocalTime: null });

    // When
    const result = toTodo(dto);

    // Then
    expect(result.localTime).toBeNull();
    expect(result.scheduledAt).toBe(instant);
  });

  it('isAllDay, completed, visibility 매핑', () => {
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
  it('subTodos 배열 매핑', () => {
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

  it('빈 subTodos → 빈 배열 + zero stats', () => {
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
  it('completions 배열 + totalCompleteDays', () => {
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
  it('소유자 응답의 규칙을 앱 모델로 옮긴다', () => {
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

  it('구 서버·친구 응답처럼 키가 없으면 규칙은 null이다', () => {
    // Given
    const { repeat: _repeat, ...dto } = createTodoDto({ recurrenceGroupId: 'series-1' });

    // When
    const todo = toTodo(dto);

    // Then
    expect(todo.repeat).toBeNull();
    expect(todo.recurrenceGroupId).toBe('series-1');
  });
});

describe('계약 응답과 앱 스키마', () => {
  it('계약을 통과한 할 일 목록을 매핑하면 앱 목록 스키마를 통과한다', () => {
    // Given
    const dto = todoListResponseSchema.parse(
      createTodoListResponseDto({
        items: [
          createTodoDto({
            scheduledLocalTime: '09:00',
            repeat: { frequency: 'DAILY', end: { type: 'NEVER' } },
            items: [createTodoItemResponseDto({ completed: true })],
            itemStats: { total: 1, completed: 1 },
          }),
          createTodoDto({ id: 2, isAllDay: true, scheduledTime: null, repeat: undefined }),
        ],
        pagination: { hasNext: true, nextCursor: 2, size: 20 },
      }),
    );

    // When
    const result = toTodoListResult(dto);

    // Then
    expect(todoListResultSchema.parse(result)).toEqual(result);
  });

  it('계약을 통과한 달성 기간을 매핑하면 앱 달성 스키마를 통과한다', () => {
    // Given
    const dto = dailyCompletionsRangeResponseSchema.parse(
      createDailyCompletionsDto({
        multiDayTodos: [
          {
            startDate: '2026-03-01',
            endDate: '2026-03-03',
            completed: false,
            categoryColor: '#4A90D9',
          },
        ],
      }),
    );

    // When
    const result = toDailyCompletionsResult(dto);

    // Then
    expect(dailyCompletionsResultSchema.parse(result)).toEqual(result);
  });
});
