import { toInstant } from '@src/shared/date/instant';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { TodoPolicy } from './todo.model';

describe('isLastOpenTodo', () => {
  it('할 일이 하나뿐인 날도 그 하나를 끝내면 다 끝낸 날이다', () => {
    // Given
    const todos = [createParentTodo({ id: 1, completed: true })];

    // When
    const result = TodoPolicy.isLastOpenTodo(todos, 1);

    // Then
    expect(result).toBe(true);
  });

  it('어제 시작한 여러 날 할 일을 오늘 끝내면 오늘 목록에 미완료로 남아 있어도 끝낸 것으로 본다', () => {
    // Given
    const multiDay = createParentTodo({
      id: 7,
      startDate: '2026-10-26',
      endDate: '2026-10-28',
      completed: false,
    });
    const lastOpen = [createParentTodo({ id: 1, completed: true }), multiDay];
    const oneMoreOpen = [...lastOpen, createParentTodo({ id: 2, completed: false })];

    // When
    const lastOpenResult = TodoPolicy.isLastOpenTodo(lastOpen, 7);
    const oneMoreOpenResult = TodoPolicy.isLastOpenTodo(oneMoreOpen, 7);

    // Then
    // 낙관적 갱신은 시작일 목록에만 반영돼 오늘 목록에는 아직 미완료다
    expect(lastOpenResult).toBe(true);
    expect(oneMoreOpenResult).toBe(false);
  });

  it('끝낸 할 일이 그날 목록에 없거나 할 일이 없는 날은 다 끝낸 날이 아니다', () => {
    // Given
    const todos = [createParentTodo({ id: 1, completed: true })];

    // When
    const notInList = TodoPolicy.isLastOpenTodo(todos, 9);
    const emptyDay = TodoPolicy.isLastOpenTodo([], 1);

    // Then
    expect(notInList).toBe(false);
    expect(emptyDay).toBe(false);
  });
});

describe('getShiftedEndDate', () => {
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

describe('getLocalTime', () => {
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

    // When
    const allDayTime = TodoPolicy.getLocalTime(allDay, 'Asia/Seoul');
    const noTimeTime = TodoPolicy.getLocalTime(noTime, 'Asia/Seoul');

    // Then
    expect(allDayTime).toBeNull();
    expect(noTimeTime).toBeNull();
  });
});

describe('hasUpcomingTimedTodo', () => {
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

describe('isPrivate', () => {
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
});

describe('findTodo', () => {
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

describe('getOptimisticListDate', () => {
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

describe('withVisibilityToggled', () => {
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

describe('getVisibility', () => {
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

describe('hasScheduleChanged', () => {
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

describe('isTodoOnDate', () => {
  it.each([
    {
      title: '하루짜리는 그날만 포함한다',
      todo: { startDate: '2026-11-05', endDate: null },
      date: '2026-11-05',
      expected: true,
    },
    {
      title: '하루짜리는 다음 날에는 포함하지 않는다',
      todo: { startDate: '2026-11-05', endDate: null },
      date: '2026-11-06',
      expected: false,
    },
    {
      title: '여러 날은 시작일을 포함한다',
      todo: { startDate: '2026-11-05', endDate: '2026-11-07' },
      date: '2026-11-05',
      expected: true,
    },
    {
      title: '여러 날은 종료일을 포함한다',
      todo: { startDate: '2026-11-05', endDate: '2026-11-07' },
      date: '2026-11-07',
      expected: true,
    },
    {
      title: '여러 날은 시작일 전날을 포함하지 않는다',
      todo: { startDate: '2026-11-05', endDate: '2026-11-07' },
      date: '2026-11-04',
      expected: false,
    },
    {
      title: '여러 날은 종료일 다음 날을 포함하지 않는다',
      todo: { startDate: '2026-11-05', endDate: '2026-11-07' },
      date: '2026-11-08',
      expected: false,
    },
  ])('$title', ({ todo, date, expected }) => {
    // When
    const result = TodoPolicy.isTodoOnDate(todo, date);

    // Then
    expect(result).toBe(expected);
  });
});

describe('isMultiDayTodo', () => {
  it.each([
    { title: '종료일이 없으면 여러 날이 아니다', endDate: null, expected: false },
    { title: '종료일이 시작일과 같으면 여러 날이 아니다', endDate: '2026-11-05', expected: false },
    { title: '종료일이 시작일보다 늦으면 여러 날이다', endDate: '2026-11-06', expected: true },
  ])('$title', ({ endDate, expected }) => {
    // Given
    const todo = { startDate: '2026-11-05', endDate };

    // When
    const result = TodoPolicy.isMultiDayTodo(todo);

    // Then
    expect(result).toBe(expected);
  });
});

describe('isOptimisticTodo', () => {
  it.each([
    { title: 'id가 음수이면 서버 응답 전의 임시 행이다', id: -1, expected: true },
    { title: 'id가 양수이면 저장된 행이다', id: 1, expected: false },
  ])('$title', ({ id, expected }) => {
    // When
    const result = TodoPolicy.isOptimisticTodo({ id });

    // Then
    expect(result).toBe(expected);
  });
});

describe('canReorderTodos', () => {
  it.each([
    { title: '할 일이 없으면 순서를 바꿀 수 없다', ids: [], expected: false },
    { title: '할 일이 하나뿐이면 순서를 바꿀 수 없다', ids: [1], expected: false },
    { title: '할 일이 둘이면 순서를 바꿀 수 있다', ids: [1, 2], expected: true },
  ])('$title', ({ ids, expected }) => {
    // Given
    const todos = ids.map((id) => ({ id }));

    // When
    const result = TodoPolicy.canReorderTodos(todos);

    // Then
    expect(result).toBe(expected);
  });
});
