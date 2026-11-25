import { addDaysToDateKey } from '@src/shared/date/date-key';
import { createDateKey } from '@src/testing/date-key';
import { z } from 'zod';

import dailyCompletionCases from '../../../../../../../packages/api/test/fixtures/daily-completion-cases.json';
import { createParentTodo } from '../__tests__/sub-todo.fixtures';
import {
  DailyCompletionPolicy,
  type DailyCompletionsResult,
  getCompletionMonthRange,
  getCompletionMonthsCovering,
} from './daily-completion.model';

/**
 * 서버 tallyDailyCompletions도 같은 표를 읽는다. 앱은 하루짜리 쓰기 뒤 이 계산으로 달력을 고치고 다시 받지 않으므로
 * 두 계산이 어긋나면 어느 한쪽 테스트가 깨진다
 */
const SHARED_DAY_TALLY_CASES = z
  .object({
    dayTally: z.array(
      z.object({
        name: z.string(),
        date: z.iso.date(),
        todos: z.array(
          z.object({
            startDate: z.iso.date(),
            endDate: z.iso.date().nullable(),
            completed: z.boolean(),
            categoryColor: z.string(),
            // 같은 할 일 여러 개(199/200 같은 날)를 한 줄로 적는다
            count: z.int().positive().default(1),
          }),
        ),
        expected: z
          .object({
            totalTodos: z.int(),
            completedTodos: z.int(),
            isComplete: z.boolean(),
            completionRate: z.number(),
            categoryColors: z.array(z.string()),
          })
          .nullable(),
      }),
    ),
  })
  .parse(dailyCompletionCases).dayTally;

describe('getCompletionMonthRange', () => {
  it.each([
    { month: '2026-11-01', startDate: '2026-11-01', endDate: '2026-12-05' },
    { month: '2026-03-01', startDate: '2026-03-01', endDate: '2026-04-04' },
    { month: '2027-08-01', startDate: '2027-08-01', endDate: '2027-09-04' },
  ])('$month 칸은 $startDate(일)부터 $endDate(토)까지다', ({ month, ...expected }) => {
    // When
    const range = getCompletionMonthRange(createDateKey(month));

    // Then
    expect(range).toEqual(expected);
  });
});

describe('getCompletionMonthsCovering', () => {
  it.each([
    { name: '달 안의 주', startDate: '2026-11-23', endDate: '2026-11-29', months: ['2026-11-01'] },
    {
      name: '다음 달 첫 주까지 이어진 앞 달 칸 안의 10일',
      startDate: '2026-11-25',
      endDate: '2026-12-04',
      months: ['2026-11-01'],
    },
    {
      name: '앞 달 칸 밖으로 나가지만 다음 달 칸이 덮는 주',
      startDate: '2026-11-30',
      endDate: '2026-12-06',
      months: ['2026-12-01'],
    },
    {
      name: '어느 한 달 칸도 덮지 못하는 주',
      startDate: '2027-07-26',
      endDate: '2027-08-01',
      months: ['2027-07-01', '2027-08-01'],
    },
    {
      name: '해를 넘기는 10일',
      startDate: '2026-12-28',
      endDate: '2027-01-06',
      months: ['2027-01-01'],
    },
  ])('$name은 $months 달로 받는다', ({ startDate, endDate, months }) => {
    // When
    const covering = getCompletionMonthsCovering({
      startDate: createDateKey(startDate),
      endDate: createDateKey(endDate),
    });

    // Then
    expect(covering).toEqual(months);
  });
});

describe('DailyCompletionPolicy', () => {
  describe('withTodoDailyCompletion — 서버와 같은 하루 집계 표', () => {
    it.each(SHARED_DAY_TALLY_CASES)('$name', ({ date, todos, expected }) => {
      // Given
      const dateKey = createDateKey(date);
      const empty: DailyCompletionsResult = {
        completions: [],
        totalCompleteDays: 0,
        dateRange: {
          startDate: addDaysToDateKey(dateKey, -7),
          endDate: addDaysToDateKey(dateKey, 7),
        },
      };
      const dayTodos = todos
        .flatMap((todo) => Array.from({ length: todo.count }, () => todo))
        .map((todo, index) =>
          createParentTodo({
            id: index + 1,
            startDate: createDateKey(todo.startDate),
            endDate: todo.endDate == null ? null : createDateKey(todo.endDate),
            completed: todo.completed,
            category: { id: index + 1, name: `카테고리 ${index + 1}`, color: todo.categoryColor },
          }),
        );

      // When
      const result = DailyCompletionPolicy.withTodoDailyCompletion(empty, dateKey, dayTodos);

      // Then
      expect(result.completions).toEqual(expected == null ? [] : [{ date, ...expected }]);
      expect(result.totalCompleteDays).toBe(expected?.isComplete === true ? 1 : 0);
    });
  });

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
});
