import { toInstant } from '@src/shared/date/instant';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { TodoPolicy } from './todo.model';

describe('TodoPolicy.completesAllTodos', () => {
  it('할 일이 하나뿐인 날도 그 하나를 끝내면 다 끝낸 날이다', () => {
    // Given
    const todos = [createParentTodo({ id: 1, completed: true })];

    // When / Then
    expect(TodoPolicy.completesAllTodos(todos, 1)).toBe(true);
  });

  it('어제 시작한 여러 날 할 일을 오늘 끝내면 오늘 목록에 미완료로 남아 있어도 끝낸 것으로 본다', () => {
    // Given 낙관적 갱신은 시작일 목록에만 반영돼 오늘 목록에는 아직 미완료다
    const multiDay = createParentTodo({
      id: 7,
      startDate: '2026-10-26',
      endDate: '2026-10-28',
      completed: false,
    });
    const lastOpen = [createParentTodo({ id: 1, completed: true }), multiDay];
    const oneMoreOpen = [...lastOpen, createParentTodo({ id: 2, completed: false })];

    // When / Then
    expect(TodoPolicy.completesAllTodos(lastOpen, 7)).toBe(true);
    expect(TodoPolicy.completesAllTodos(oneMoreOpen, 7)).toBe(false);
  });

  it('끝낸 할 일이 그날 목록에 없거나 할 일이 없는 날은 다 끝낸 날이 아니다', () => {
    expect(TodoPolicy.completesAllTodos([createParentTodo({ id: 1, completed: true })], 9)).toBe(
      false,
    );
    expect(TodoPolicy.completesAllTodos([], 1)).toBe(false);
  });
});

describe('TodoPolicy.getShiftedEndDate', () => {
  it('날짜를 옮겨도 기간 길이를 유지하고 하루짜리는 null이다', () => {
    // Given
    const multiDay = { startDate: '2026-11-05', endDate: '2026-11-07' };
    const oneDay = { startDate: '2026-11-05', endDate: null };

    // When
    const shifted = TodoPolicy.getShiftedEndDate(multiDay, '2026-11-29');
    const unchanged = TodoPolicy.getShiftedEndDate(oneDay, '2026-11-29');

    // Then
    expect(shifted).toBe('2026-12-01');
    expect(unchanged).toBeNull();
  });
});

describe('TodoPolicy.getLocalTime', () => {
  const instant = toInstant('2026-11-05T01:00:00.000Z');

  it('서버가 준 벽시계는 시간대를 바꿔도 같은 오전 10시다', () => {
    // Given
    const todo = { isAllDay: false, localTime: '10:00', scheduledAt: instant };

    // When
    const seoul = TodoPolicy.getLocalTime(todo, 'Asia/Seoul');
    const newYork = TodoPolicy.getLocalTime(todo, 'America/New_York');

    // Then
    expect(seoul).toBe('10:00');
    expect(newYork).toBe('10:00');
  });

  it('서버가 벽시계 칸을 비운 시간 행은 보는 순간의 시간대로 계산한다', () => {
    // Given
    const todo = { isAllDay: false, localTime: null, scheduledAt: instant };

    // When
    const seoul = TodoPolicy.getLocalTime(todo, 'Asia/Seoul');
    const newYork = TodoPolicy.getLocalTime(todo, 'America/New_York');

    // Then
    expect(seoul).toBe('10:00');
    expect(newYork).toBe('20:00');
  });

  it('서머타임이 시작되는 날도 순간을 그 날의 오프셋으로 계산한다', () => {
    // Given
    const todo = {
      isAllDay: false,
      localTime: null,
      scheduledAt: toInstant('2026-03-08T07:30:00.000Z'),
    };

    // When
    const time = TodoPolicy.getLocalTime(todo, 'America/New_York');

    // Then
    expect(time).toBe('03:30');
  });

  it('종일이거나 시간이 없으면 null이다', () => {
    // Given
    const allDay = { isAllDay: true, localTime: '10:00', scheduledAt: instant };
    const noTime = { isAllDay: false, localTime: null, scheduledAt: null };

    // When / Then
    expect(TodoPolicy.getLocalTime(allDay, 'Asia/Seoul')).toBeNull();
    expect(TodoPolicy.getLocalTime(noTime, 'Asia/Seoul')).toBeNull();
  });
});

describe('TodoPolicy.hasUpcomingTimedTodo', () => {
  const now = { dateKey: '2026-11-05', time: '12:00', timeZone: 'Asia/Seoul' };

  it.each([
    ['내일 시간 있는 할 일', { startDate: '2026-11-06', localTime: '09:00' }, true],
    ['오늘 아직 지나지 않은 시각', { startDate: '2026-11-05', localTime: '12:30' }, true],
    ['오늘 이미 지난 시각', { startDate: '2026-11-05', localTime: '11:59' }, false],
    ['어제 시각', { startDate: '2026-11-04', localTime: '23:00' }, false],
    ['종일 할 일', { startDate: '2026-11-06', localTime: null }, false],
    ['완료한 할 일', { startDate: '2026-11-06', localTime: '09:00', completed: true }, false],
  ])('%s', (_name, overrides, expected) => {
    // Given
    const todos = [createParentTodo({ completed: false, ...overrides })];

    // When
    const result = TodoPolicy.hasUpcomingTimedTodo(todos, now);

    // Then
    expect(result).toBe(expected);
  });
});

describe('TodoPolicy 시트 대상과 공개 범위', () => {
  it('비공개로 정한 할 일만 비공개다', () => {
    // When
    const results = [
      TodoPolicy.isPrivate({ visibility: 'PRIVATE' }),
      TodoPolicy.isPrivate({ visibility: 'PUBLIC' }),
      TodoPolicy.isPrivate({ visibility: null }),
    ];

    // Then
    expect(results).toEqual([true, false, false]);
  });

  it('목록에서 사라진 할 일은 찾지 못한다', () => {
    // Given
    const todos = [createParentTodo({ id: 1 }), createParentTodo({ id: 2 })];

    // When
    const found = TodoPolicy.findTodo(todos, 2);
    const deleted = TodoPolicy.findTodo(todos, 9);

    // Then
    expect(found?.id).toBe(2);
    expect(deleted).toBeNull();
  });
});

describe('TodoPolicy.getOptimisticListDate', () => {
  it('오늘이 기간 안인 여러 날 할 일은 오늘 목록을, 그 밖은 시작일 목록을 고친다', () => {
    // Given
    const multiDay = { startDate: '2026-11-05', endDate: '2026-11-09' };
    const pastOneDay = { startDate: '2026-11-01', endDate: null };

    // When
    const dates = [
      TodoPolicy.getOptimisticListDate(multiDay, '2026-11-07'),
      TodoPolicy.getOptimisticListDate(pastOneDay, '2026-11-07'),
    ];

    // Then
    expect(dates).toEqual(['2026-11-07', '2026-11-01']);
  });
});

describe('TodoPolicy.withVisibilityToggled', () => {
  it.each([
    ['PRIVATE', 'PUBLIC'],
    ['PUBLIC', 'PRIVATE'],
    [null, 'PRIVATE'],
  ] as const)('공개 범위가 %s이면 %s로 바꾼다', (visibility, expected) => {
    // When
    const toggled = TodoPolicy.withVisibilityToggled({ visibility });

    // Then
    expect(toggled.visibility).toBe(expected);
  });
});

describe('TodoPolicy.getVisibility', () => {
  it.each([
    [null, 'PUBLIC'],
    [undefined, 'PUBLIC'],
    ['PUBLIC', 'PUBLIC'],
    ['PRIVATE', 'PRIVATE'],
  ] as const)('공개 범위를 %s로 두면 %s로 본다', (visibility, expected) => {
    // When
    const result = TodoPolicy.getVisibility({ visibility });

    // Then
    expect(result).toBe(expected);
  });
});

describe('TodoPolicy.hasScheduleChanged', () => {
  it.each([
    {
      title: '시각이 같으면 바뀐 것이 아니다',
      next: ['10:00', false],
      previous: ['10:00', false],
      expected: false,
    },
    {
      title: '시각이 다르면 바뀐 것이다',
      next: ['11:00', false],
      previous: ['10:00', false],
      expected: true,
    },
    {
      title: '종일에서 시각으로 바꾸면 바뀐 것이다',
      next: ['10:00', false],
      previous: [null, true],
      expected: true,
    },
    {
      title: '시각에서 종일로 바꾸면 남은 시각이 같아도 바뀐 것이다',
      next: ['10:00', true],
      previous: ['10:00', false],
      expected: true,
    },
    {
      title: '종일끼리는 남은 시각 값이 달라도 바뀐 것이 아니다',
      next: ['11:00', true],
      previous: [null, true],
      expected: false,
    },
  ] as const)('$title', ({ next, previous, expected }) => {
    // Given
    const [nextTime, nextIsAllDay] = next;
    const [previousTime, previousIsAllDay] = previous;

    // When
    const result = TodoPolicy.hasScheduleChanged(
      { scheduledTime: nextTime, isAllDay: nextIsAllDay },
      { scheduledTime: previousTime, isAllDay: previousIsAllDay },
    );

    // Then
    expect(result).toBe(expected);
  });
});
