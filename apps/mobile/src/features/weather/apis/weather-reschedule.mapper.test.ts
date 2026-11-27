import { createParentTodo } from '@src/features/planning/todo/__tests__/sub-todo.fixtures';
import { toInstant } from '@src/shared/date/instant';
import { createDateKey } from '@src/testing/date-key';

import {
  toMovedScheduleRequest,
  toOriginalScheduleRequest,
  toRescheduleOutcome,
} from './weather-reschedule.mapper';

describe('toRescheduleOutcome', () => {
  const targets = [{ todo: { id: 1 } }, { todo: { id: 2 } }, { todo: { id: 3 } }];

  it('3개가 모두 실패하면 옮긴 것은 없고 실패 이유 3개를 돌려준다', () => {
    // Given
    const results = targets.map(() => ({ status: 'rejected', reason: new Error('500') }) as const);

    // When
    const outcome = toRescheduleOutcome(targets, results);

    // Then
    expect(outcome.moved).toEqual([]);
    expect(outcome.failures).toHaveLength(3);
  });

  it('일부만 실패하면 성공한 할 일만 옮긴 것으로 센다', () => {
    // Given
    const results = [
      { status: 'fulfilled', value: undefined },
      { status: 'rejected', reason: new Error('500') },
      { status: 'fulfilled', value: undefined },
    ] as const;

    // When
    const outcome = toRescheduleOutcome(targets, results);

    // Then
    expect(outcome.moved).toEqual([{ id: 1 }, { id: 3 }]);
    expect(outcome.failures).toHaveLength(1);
  });
});

describe('toMovedScheduleRequest', () => {
  it('옮길 때는 날짜를 그대로 두고 기기 시간대의 시각만 바꾼다', () => {
    // Given
    // 서울 19:00. 실행 기기 시간대와 상관없이 같은 순간이다
    const startsAt = toInstant('2026-11-02T10:00:00.000Z');

    // When
    const input = toMovedScheduleRequest(
      { startDate: createDateKey('2026-11-02'), endDate: null },
      startsAt,
      'Asia/Seoul',
    );

    // Then
    expect(input).toEqual({
      startDate: '2026-11-02',
      endDate: null,
      scheduledTime: '19:00',
      isAllDay: false,
    });
  });
});

describe('toOriginalScheduleRequest', () => {
  it('되돌릴 때는 원래 날짜와 시각을 그대로 되돌린다', () => {
    // Given
    const todo = createParentTodo({
      startDate: createDateKey('2026-11-02'),
      endDate: createDateKey('2026-11-03'),
      localTime: '16:30',
      scheduledAt: toInstant('2026-11-02T07:30:00.000Z'),
    });

    // When
    const input = toOriginalScheduleRequest(todo, 'Asia/Seoul');

    // Then
    expect(input).toEqual({
      startDate: '2026-11-02',
      endDate: '2026-11-03',
      scheduledTime: '16:30',
      isAllDay: false,
    });
  });

  it('서버가 벽시계를 비운 할 일을 되돌려도 시각이 지워지지 않고 그 순간의 기기 시각으로 되돌린다', () => {
    // Given
    // 서울 16:30. 날씨 목록도 같은 대체로 이 할 일을 16:30으로 보인다
    const todo = createParentTodo({
      startDate: createDateKey('2026-11-02'),
      localTime: null,
      scheduledAt: toInstant('2026-11-02T07:30:00.000Z'),
    });

    // When
    const input = toOriginalScheduleRequest(todo, 'Asia/Seoul');

    // Then
    expect(input).toMatchObject({ scheduledTime: '16:30', isAllDay: false });
  });

  it('종일이었다면 시각 없이 종일로 되돌린다', () => {
    // Given
    const todo = createParentTodo({
      startDate: createDateKey('2026-11-02'),
      localTime: '16:30',
      isAllDay: true,
    });

    // When
    const input = toOriginalScheduleRequest(todo, 'Asia/Seoul');

    // Then
    expect(input).toMatchObject({ scheduledTime: null, isAllDay: true });
  });
});
