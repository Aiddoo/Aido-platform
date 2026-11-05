import { createParentTodo } from '../__tests__/sub-todo.factories';
import { type DailyCompletionsResult, TodoPolicy } from './todo.model';

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

describe('TodoPolicy.withDailyCompletionFromTodos', () => {
  const DATE = '2026-11-05';
  const RED = { id: 1, name: '빨강', color: '#FF0000' };
  const BLUE = { id: 2, name: '파랑', color: '#0000FF' };
  const createResult = (): DailyCompletionsResult => ({
    completions: [
      {
        date: '2026-11-03',
        totalTodos: 1,
        completedTodos: 1,
        isComplete: true,
        completionRate: 100,
        categoryColors: ['#FF0000'],
      },
      {
        date: DATE,
        totalTodos: 1,
        completedTodos: 0,
        isComplete: false,
        completionRate: 0,
        categoryColors: ['#FF0000'],
      },
    ],
    totalCompleteDays: 1,
    dateRange: { startDate: '2026-11-01', endDate: '2026-11-07' },
  });

  it('그날 할 일로 숫자·달성·완료율·색을 다시 계산하고 달성한 날 수를 맞춘다', () => {
    // Given
    const todos = [
      createParentTodo({ id: 1, startDate: DATE, category: RED, completed: true }),
      createParentTodo({ id: 2, startDate: DATE, category: RED, completed: true }),
      createParentTodo({ id: 3, startDate: DATE, category: BLUE, completed: false }),
    ];

    // When
    const result = TodoPolicy.withDailyCompletionFromTodos(createResult(), DATE, todos);

    // Then
    expect(result.completions[1]).toEqual({
      date: DATE,
      totalTodos: 3,
      completedTodos: 2,
      isComplete: false,
      completionRate: 67,
      categoryColors: ['#FF0000', '#0000FF'],
    });
    expect(result.totalCompleteDays).toBe(1);
  });

  it('마지막 할 일을 끝내면 달성한 날이 되고 지워서 없어지면 그날 요약이 사라진다', () => {
    // Given
    const done = [createParentTodo({ startDate: DATE, category: RED, completed: true })];

    // When
    const completed = TodoPolicy.withDailyCompletionFromTodos(createResult(), DATE, done);
    const emptied = TodoPolicy.withDailyCompletionFromTodos(createResult(), DATE, []);

    // Then
    expect(completed.totalCompleteDays).toBe(2);
    expect(emptied.completions.map((completion) => completion.date)).toEqual(['2026-11-03']);
  });

  it('요약이 없던 날에 첫 할 일이 생기면 날짜 순서대로 들어간다', () => {
    // Given
    const todos = [createParentTodo({ startDate: '2026-11-04', category: RED })];

    // When
    const result = TodoPolicy.withDailyCompletionFromTodos(createResult(), '2026-11-04', todos);

    // Then
    expect(result.completions.map((completion) => completion.date)).toEqual([
      '2026-11-03',
      '2026-11-04',
      DATE,
    ]);
  });

  it('조회 범위 밖 날짜는 바꾸지 않고 다른 날 시작한 여러 날 할 일은 세지 않는다', () => {
    // Given
    const given = createResult();
    const multiDay = createParentTodo({ startDate: '2026-11-04', endDate: DATE, category: BLUE });

    // When
    const outside = TodoPolicy.withDailyCompletionFromTodos(given, '2026-11-20', [multiDay]);
    const counted = TodoPolicy.withDailyCompletionFromTodos(given, DATE, [
      multiDay,
      createParentTodo({ id: 2, startDate: DATE, category: RED }),
    ]);

    // Then
    expect(outside).toBe(given);
    expect(counted.completions[1]?.totalTodos).toBe(1);
  });
});

describe('TodoPolicy.hasUpcomingTimedTodo', () => {
  const now = { dateKey: '2026-11-05', time: '12:00' };

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
