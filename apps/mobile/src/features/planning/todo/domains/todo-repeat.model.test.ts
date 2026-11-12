import { todoRepeatSchema as todoRepeatDtoSchema } from '@aido/api';
import { createDateKey } from '@src/testing/date-key';
import { z } from 'zod';

import repeatLastOccurrenceCases from '../../../../../../../packages/api/test/fixtures/repeat-last-occurrence-cases.json';
import repeatOccurrenceCases from '../../../../../../../packages/api/test/fixtures/repeat-occurrence-cases.json';
import { toRepeat } from '../apis/todo-repeat.mapper';
import { type TodoRepeat, todoRepeatSchema } from './todo-repeat.model';
import { TodoRepeatPolicy } from './todo-repeat.model';

/** 서버 RepeatRule도 같은 표를 읽는다. 두 구현이 어긋나면 어느 한쪽 테스트가 깨진다 */
const SHARED_OCCURRENCE_CASES = z
  .array(
    z.object({
      name: z.string(),
      startDate: z.iso.date(),
      repeat: todoRepeatDtoSchema,
      through: z.iso.date(),
      expected: z.array(z.iso.date()),
    }),
  )
  .parse(repeatOccurrenceCases);

/** 서버 RepeatRule이 같은 표로 끝까지 센 회차와 비교한다. 미리보기의 간격 점프 걷기를 지킨다 */
const SHARED_LAST_OCCURRENCE_CASES = z
  .array(
    z.object({
      name: z.string(),
      startDate: z.iso.date(),
      repeat: todoRepeatDtoSchema,
      expectedCount: z.int().positive(),
      expectedLast: z.iso.date(),
    }),
  )
  .parse(repeatLastOccurrenceCases);

const MONDAY = createDateKey('2026-11-02');
const WEDNESDAY = createDateKey('2026-11-04');

const createWeekly = (overrides: Partial<Extract<TodoRepeat, { frequency: 'WEEKLY' }>> = {}) =>
  todoRepeatSchema.parse({
    frequency: 'WEEKLY',
    interval: 1,
    weekdays: ['MON'],
    end: { type: 'NEVER' },
    ...overrides,
  });

const createMonthly = (monthDay: number) =>
  todoRepeatSchema.parse({ frequency: 'MONTHLY', monthDay, end: { type: 'NEVER' } });

const withUntil = (repeat: TodoRepeat, date: string): TodoRepeat => ({
  ...repeat,
  end: { type: 'UNTIL', date: createDateKey(date) },
});

const withCount = (repeat: TodoRepeat, count: number): TodoRepeat => ({
  ...repeat,
  end: { type: 'COUNT', count },
});

describe('getRepeatKind', () => {
  it('월~금 매주는 평일, 7요일 매주는 매일, 격주는 격주로 읽는다', () => {
    // Given
    const weekdays = createWeekly({ weekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI'] });
    const everyDay = createWeekly({
      weekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
    });
    const biweekly = createWeekly({ interval: 2 });

    // When
    const kinds = [weekdays, everyDay, biweekly].map(TodoRepeatPolicy.getRepeatKind);

    // Then
    expect(kinds).toEqual(['WEEKDAYS', 'DAILY', 'BIWEEKLY']);
  });
});

describe('withRepeatStartDate', () => {
  it('매월 n일은 새 시작일의 날짜를 따라간다', () => {
    // Given
    const repeat = createMonthly(15);

    // When
    const moved = TodoRepeatPolicy.withRepeatStartDate(
      repeat,
      createDateKey('2026-11-15'),
      createDateKey('2026-12-31'),
    );

    // Then
    expect(moved).toMatchObject({ frequency: 'MONTHLY', monthDay: 31 });
  });

  it('시작일 요일만 골랐다면 새 시작일 요일로 옮기고, 직접 고른 요일은 그대로 둔다', () => {
    // Given
    const byDefault = createWeekly({ weekdays: ['MON'] });
    const custom = createWeekly({ weekdays: ['MON', 'FRI'] });

    // When
    const movedDefault = TodoRepeatPolicy.withRepeatStartDate(byDefault, MONDAY, WEDNESDAY);
    const movedCustom = TodoRepeatPolicy.withRepeatStartDate(custom, MONDAY, WEDNESDAY);

    // Then
    expect(movedDefault).toMatchObject({ weekdays: ['WED'] });
    expect(movedCustom).toMatchObject({ weekdays: ['MON', 'FRI'] });
  });

  it('시작일보다 앞선 종료일은 시작일로 당긴다', () => {
    // Given
    const repeat = withUntil(createWeekly(), '2026-11-10');

    // When
    const moved = TodoRepeatPolicy.withRepeatStartDate(repeat, MONDAY, createDateKey('2026-11-20'));

    // Then
    expect(moved.end).toEqual({ type: 'UNTIL', date: '2026-11-20' });
  });
});

describe('isRepeatMonthDayClamped', () => {
  it('29일부터는 짧은 달 말일 보정 안내 대상이다', () => {
    // Given
    const day28 = createMonthly(28);
    const day29 = createMonthly(29);

    // When
    const results = [day28, day29].map((repeat) =>
      TodoRepeatPolicy.isRepeatMonthDayClamped(repeat),
    );

    // Then
    expect(results).toEqual([false, true]);
  });
});

describe('getRepeatOccurrenceDateKeys', () => {
  const NOVEMBER = { from: createDateKey('2026-11-01'), to: createDateKey('2026-11-30') };

  it('주말이면 시작일 이후의 토·일만 회차다', () => {
    // Given
    const repeat = createWeekly({ weekdays: ['SAT', 'SUN'] });

    // When
    const dates = TodoRepeatPolicy.getRepeatOccurrenceDateKeys(repeat, WEDNESDAY, {
      from: createDateKey('2026-11-01'),
      to: createDateKey('2026-11-15'),
    });

    // Then
    expect(dates).toEqual(['2026-11-07', '2026-11-08', '2026-11-14', '2026-11-15']);
  });

  it('매일은 시작일부터 범위 끝까지 전부 회차다', () => {
    // Given
    const repeat = todoRepeatSchema.parse({ frequency: 'DAILY', end: { type: 'NEVER' } });

    // When
    const dates = TodoRepeatPolicy.getRepeatOccurrenceDateKeys(repeat, WEDNESDAY, {
      from: createDateKey('2026-11-01'),
      to: createDateKey('2026-11-06'),
    });

    // Then
    expect(dates).toEqual(['2026-11-04', '2026-11-05', '2026-11-06']);
  });

  it('격주는 시작일이 속한 주를 기준으로 한 주씩 건너뛴다', () => {
    // Given
    const repeat = createWeekly({ interval: 2, weekdays: ['MON', 'FRI'] });

    // When
    const dates = TodoRepeatPolicy.getRepeatOccurrenceDateKeys(repeat, WEDNESDAY, NOVEMBER);

    // Then
    expect(dates).toEqual(['2026-11-06', '2026-11-16', '2026-11-20', '2026-11-30']);
  });

  it('매월 n일은 그 날이 없는 달이면 말일이다', () => {
    // Given
    const repeat = todoRepeatSchema.parse({
      frequency: 'MONTHLY',
      monthDay: 31,
      end: { type: 'NEVER' },
    });

    // When
    const dates = TodoRepeatPolicy.getRepeatOccurrenceDateKeys(
      repeat,
      createDateKey('2026-10-31'),
      {
        from: createDateKey('2026-10-01'),
        to: createDateKey('2027-03-01'),
      },
    );

    // Then
    expect(dates).toEqual(['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
  });

  it('날짜 종료는 종료일을 포함하고 그 뒤는 회차가 아니다', () => {
    // Given
    const repeat = withUntil(createWeekly({ weekdays: ['MON'] }), '2026-11-16');

    // When
    const dates = TodoRepeatPolicy.getRepeatOccurrenceDateKeys(repeat, MONDAY, NOVEMBER);

    // Then
    expect(dates).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
  });

  it('횟수 종료는 그 횟수에서 멈추고 달을 넘겨도 이어 센다', () => {
    // Given
    const repeat = withCount(createWeekly({ weekdays: ['MON'] }), 3);

    // When
    const dates = TodoRepeatPolicy.getRepeatOccurrenceDateKeys(
      repeat,
      createDateKey('2026-11-23'),
      {
        from: createDateKey('2026-11-30'),
        to: createDateKey('2026-12-31'),
      },
    );

    // Then
    expect(dates).toEqual(['2026-11-30', '2026-12-07']);
  });
});

describe('findFirstRepeatOccurrenceDateKey', () => {
  it('시작일이 회차가 아니면 그 뒤 첫 회차다', () => {
    // Given
    const repeat = createWeekly({ weekdays: ['SAT', 'SUN'] });

    // When
    const first = TodoRepeatPolicy.findFirstRepeatOccurrenceDateKey(repeat, WEDNESDAY);

    // Then
    expect(first).toBe('2026-11-07');
  });

  it('종료일 안에 회차가 없으면 null이다', () => {
    // Given
    const repeat = withUntil(createWeekly({ weekdays: ['SAT'] }), '2026-11-06');

    // When
    const first = TodoRepeatPolicy.findFirstRepeatOccurrenceDateKey(repeat, WEDNESDAY);

    // Then
    expect(first).toBeNull();
  });
});

describe('findLastRepeatOccurrenceDateKey', () => {
  it('횟수 종료는 마지막 회차, 끝이 없으면 null이다', () => {
    // Given
    const counted = withCount(createWeekly({ weekdays: ['MON', 'WED'] }), 3);
    const forever = createWeekly();

    // When
    const results = [counted, forever].map((repeat) =>
      TodoRepeatPolicy.findLastRepeatOccurrenceDateKey(repeat, MONDAY),
    );

    // Then
    expect(results).toEqual(['2026-11-09', null]);
  });
});

describe('hasSameRepeat', () => {
  const daily: TodoRepeat = { frequency: 'DAILY', end: { type: 'NEVER' } };
  const everyDay = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
  const allDays = createWeekly({ weekdays: [...everyDay] });

  it.each([
    { name: '7요일 매주와 매일', repeat: allDays, other: daily, expected: true },
    {
      name: '요일 순서만 다른 매주',
      repeat: createWeekly({ weekdays: ['MON', 'THU'] }),
      other: createWeekly({ weekdays: ['THU', 'MON'] }),
      expected: true,
    },
    {
      name: '격주와 매주',
      repeat: createWeekly({ interval: 2 }),
      other: createWeekly(),
      expected: false,
    },
    {
      name: '7요일 격주와 매일',
      repeat: createWeekly({ interval: 2, weekdays: [...everyDay] }),
      other: daily,
      expected: false,
    },
    {
      name: '끝 횟수만 다른 매일',
      repeat: withCount(daily, 1),
      other: withCount(daily, 2),
      expected: false,
    },
    { name: '반복 없음 둘', repeat: null, other: null, expected: true },
    { name: '없던 반복을 만들기', repeat: null, other: daily, expected: false },
  ] satisfies {
    name: string;
    repeat: TodoRepeat | null;
    other: TodoRepeat | null;
    expected: boolean;
  }[])('$name는 같은 규칙인지: $expected', ({ repeat, other, expected }) => {
    // When
    const result = TodoRepeatPolicy.hasSameRepeat(repeat, other);

    // Then
    expect(result).toBe(expected);
  });
});

describe('todoRepeatSchema 끝 횟수', () => {
  it.each([
    { count: 0, isValid: false },
    { count: 1, isValid: true },
    { count: 365, isValid: true },
    { count: 366, isValid: false },
  ])('$count번은 쓸 수 있는지: $isValid', ({ count, isValid }) => {
    // When
    const result = todoRepeatSchema.safeParse({
      frequency: 'DAILY',
      end: { type: 'COUNT', count },
    });

    // Then
    expect(result.success).toBe(isValid);
  });
});

describe('getTodoEditScopeDecision', () => {
  const rule: TodoRepeat = { frequency: 'DAILY', end: { type: 'NEVER' } };

  it.each([
    {
      title: '시리즈가 아니고 반복 규칙이 없으면 no-scope이다',
      input: { isSeries: false, isDateOnly: false },
      expected: 'no-scope',
    },
    {
      title: '시리즈가 아니면 반복 규칙이 있어도 no-scope이다',
      input: { isSeries: false, repeat: rule, isDateOnly: false },
      expected: 'no-scope',
    },
    {
      title: '시리즈여도 반복 규칙이 null이면 no-scope이다',
      input: { isSeries: true, repeat: null, isDateOnly: false },
      expected: 'no-scope',
    },
    {
      title: '시리즈이고 반복 규칙이 있으면 이후 전체만 묻는다',
      input: { isSeries: true, repeat: rule, isDateOnly: false },
      expected: 'ask-following-only',
    },
    {
      title: '시리즈의 날짜만 바꾸면 이번 회차만 바꾼다',
      input: { isSeries: true, isDateOnly: true },
      expected: 'this-only',
    },
    {
      title: '시리즈의 날짜 외 항목을 바꾸면 범위를 묻는다',
      input: { isSeries: true, isDateOnly: false },
      expected: 'ask',
    },
  ] as const)('$title', ({ input, expected }) => {
    // When
    const decision = TodoRepeatPolicy.getTodoEditScopeDecision(input);

    // Then
    expect(decision).toBe(expected);
  });
});

const HORIZON_TODAY = createDateKey('2026-11-05');

describe('isBeyondRepeatHorizon', () => {
  it.each([
    { title: '오늘은 미리 만든 범위 안이다', dateKey: '2026-11-05', expected: false },
    { title: '오늘 + 90일은 미리 만든 범위 안이다', dateKey: '2027-02-03', expected: false },
    { title: '오늘 + 91일부터는 미리 만든 범위를 넘는다', dateKey: '2027-02-04', expected: true },
  ])('$title', ({ dateKey, expected }) => {
    // When
    const result = TodoRepeatPolicy.isBeyondRepeatHorizon(createDateKey(dateKey), HORIZON_TODAY);

    // Then
    expect(result).toBe(expected);
  });
});

describe('isMonthBeyondRepeatHorizon', () => {
  it.each([
    { title: '말일이 범위 안인 달은 넘어간 달이 아니다', dateKey: '2027-01-15', expected: false },
    {
      title: '말일이 범위를 넘는 달은 월초여도 넘어간 달이다',
      dateKey: '2027-02-01',
      expected: true,
    },
    { title: '범위를 완전히 벗어난 달은 넘어간 달이다', dateKey: '2027-03-01', expected: true },
  ])('$title', ({ dateKey, expected }) => {
    // When
    const result = TodoRepeatPolicy.isMonthBeyondRepeatHorizon(
      createDateKey(dateKey),
      HORIZON_TODAY,
    );

    // Then
    expect(result).toBe(expected);
  });
});

const REPEAT_RULE = createWeekly();
const RULE_OCCURRENCE = { recurrenceGroupId: 'series-1', repeat: REPEAT_RULE };
const RULELESS_OCCURRENCE = { recurrenceGroupId: 'old-group', repeat: null };
const SINGLE_OCCURRENCE = { recurrenceGroupId: null, repeat: null };

describe('hasRepeatRule', () => {
  it.each([
    { title: '규칙 있는 회차는 반복 규칙이 있다', occurrence: RULE_OCCURRENCE, expected: true },
    {
      title: '규칙 없는 묶음은 반복 규칙이 없다',
      occurrence: RULELESS_OCCURRENCE,
      expected: false,
    },
    { title: '단일 할 일은 반복 규칙이 없다', occurrence: SINGLE_OCCURRENCE, expected: false },
  ])('$title', ({ occurrence, expected }) => {
    // When
    const result = TodoRepeatPolicy.hasRepeatRule(occurrence);

    // Then
    expect(result).toBe(expected);
  });
});

describe('canChangeRepeat', () => {
  it.each([
    { title: '규칙 있는 회차는 반복을 바꿀 수 있다', occurrence: RULE_OCCURRENCE, expected: true },
    {
      title: '규칙 없는 묶음은 반복을 바꿀 수 없다',
      occurrence: RULELESS_OCCURRENCE,
      expected: false,
    },
    {
      title: '단일 할 일은 반복을 새로 정할 수 있다',
      occurrence: SINGLE_OCCURRENCE,
      expected: true,
    },
  ])('$title', ({ occurrence, expected }) => {
    // When
    const result = TodoRepeatPolicy.canChangeRepeat(occurrence);

    // Then
    expect(result).toBe(expected);
  });
});

describe('getDeleteScopes', () => {
  it.each([
    {
      title: '규칙 있는 회차는 이번만, 이후 전체, 전체를 고를 수 있다',
      occurrence: RULE_OCCURRENCE,
      expected: ['THIS_ONLY', 'THIS_AND_FOLLOWING', 'ALL'],
    },
    {
      title: '규칙 없는 묶음은 이후 전체를 정할 수 없어 이번만과 전체만 고른다',
      occurrence: RULELESS_OCCURRENCE,
      expected: ['THIS_ONLY', 'ALL'],
    },
    {
      title: '단일 할 일은 고를 범위가 없다',
      occurrence: SINGLE_OCCURRENCE,
      expected: [],
    },
  ])('$title', ({ occurrence, expected }) => {
    // When
    const scopes = TodoRepeatPolicy.getDeleteScopes(occurrence);

    // Then
    expect(scopes).toEqual(expected);
  });
});

describe('서버와 같은 마지막 회차 표', () => {
  it.each(SHARED_LAST_OCCURRENCE_CASES)(
    '$name',
    ({ startDate, repeat, expectedCount, expectedLast }) => {
      // Given
      const appRepeat = toRepeat(repeat);

      // When
      const last = TodoRepeatPolicy.findLastRepeatOccurrenceDateKey(
        appRepeat,
        createDateKey(startDate),
      );
      const count = TodoRepeatPolicy.getRepeatOccurrenceDateKeys(
        appRepeat,
        createDateKey(startDate),
        {
          from: createDateKey(startDate),
          to: createDateKey(expectedLast),
        },
      ).length;

      // Then
      expect({ count, last }).toEqual({ count: expectedCount, last: expectedLast });
    },
  );
});

describe('서버와 같은 회차 표', () => {
  it.each(SHARED_OCCURRENCE_CASES)('$name', ({ startDate, repeat, through, expected }) => {
    // Given
    const appRepeat = toRepeat(repeat);

    // When
    const occurrences = TodoRepeatPolicy.getRepeatOccurrenceDateKeys(
      appRepeat,
      createDateKey(startDate),
      {
        from: createDateKey(startDate),
        to: createDateKey(through),
      },
    );

    // Then
    expect(occurrences).toEqual(expected);
  });
});
