import { createDateKey } from '@src/testing/date-key';

import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import { type DailyCompletionsResult } from './daily-completion.model';
import { DailyCompletionPolicy } from './daily-completion.model';

describe('withTodoDailyCompletion', () => {
  const DATE = createDateKey('2026-11-05');
  const RED = { id: 1, name: '빨강', color: '#FF0000' };
  const BLUE = { id: 2, name: '파랑', color: '#0000FF' };
  const createResult = (): DailyCompletionsResult => ({
    completions: [
      {
        date: createDateKey('2026-11-03'),
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
    dateRange: { startDate: createDateKey('2026-11-01'), endDate: createDateKey('2026-11-07') },
  });

  it('그날 할 일로 숫자·달성·완료율·색을 다시 계산하고 달성한 날 수를 맞춘다', () => {
    // Given
    const todos = [
      createParentTodo({ id: 1, startDate: DATE, category: RED, completed: true }),
      createParentTodo({ id: 2, startDate: DATE, category: RED, completed: true }),
      createParentTodo({ id: 3, startDate: DATE, category: BLUE, completed: false }),
    ];

    // When
    const result = DailyCompletionPolicy.withTodoDailyCompletion(createResult(), DATE, todos);

    // Then
    expect(result.completions[1]).toEqual({
      date: DATE,
      totalTodos: 3,
      completedTodos: 2,
      isComplete: false,
      completionRate: 67,
      // 서버 응답과 같은 순서가 되도록 정렬한다
      categoryColors: ['#0000FF', '#FF0000'],
    });
    expect(result.totalCompleteDays).toBe(1);
  });

  it('마지막 할 일을 끝내면 달성한 날이 되고 지워서 없어지면 그날 요약이 사라진다', () => {
    // Given
    const done = [createParentTodo({ startDate: DATE, category: RED, completed: true })];

    // When
    const completed = DailyCompletionPolicy.withTodoDailyCompletion(createResult(), DATE, done);
    const emptied = DailyCompletionPolicy.withTodoDailyCompletion(createResult(), DATE, []);

    // Then
    expect(completed.totalCompleteDays).toBe(2);
    expect(emptied.completions.map((completion) => completion.date)).toEqual(['2026-11-03']);
  });

  it('요약이 없던 날에 첫 할 일이 생기면 날짜 순서대로 들어간다', () => {
    // Given
    const todos = [createParentTodo({ startDate: createDateKey('2026-11-04'), category: RED })];

    // When
    const result = DailyCompletionPolicy.withTodoDailyCompletion(
      createResult(),
      createDateKey('2026-11-04'),
      todos,
    );

    // Then
    expect(result.completions.map((completion) => completion.date)).toEqual([
      '2026-11-03',
      '2026-11-04',
      DATE,
    ]);
  });

  it('조회 범위 밖 날짜는 바꾸지 않고 기간 안의 날이면 다른 날 시작한 여러 날 할 일도 센다', () => {
    // Given
    const given = createResult();
    const multiDay = createParentTodo({
      startDate: createDateKey('2026-11-04'),
      endDate: DATE,
      category: BLUE,
    });

    // When
    const outside = DailyCompletionPolicy.withTodoDailyCompletion(
      given,
      createDateKey('2026-11-20'),
      [multiDay],
    );
    const counted = DailyCompletionPolicy.withTodoDailyCompletion(given, DATE, [
      multiDay,
      createParentTodo({ id: 2, startDate: DATE, category: RED }),
    ]);

    // Then
    expect(outside).toBe(given);
    expect(counted.completions[1]?.totalTodos).toBe(2);
  });
});

describe('toCategoryColors', () => {
  it('서버가 어떤 순서로 모아도 같은 색 목록이 되어 다시 받아도 구조적 공유로 같은 값이다', () => {
    // Given
    const fromServer = ['#FF0000', '#0000FF', '#FF0000'];
    const fromList = ['#0000FF', '#FF0000'];

    // When
    const serverColors = DailyCompletionPolicy.toCategoryColors(fromServer);
    const listColors = DailyCompletionPolicy.toCategoryColors(fromList);

    // Then
    expect(serverColors).toEqual(['#0000FF', '#FF0000']);
    expect(serverColors).toEqual(listColors);
  });
});
