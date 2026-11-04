import { type TodoRepeat, TodoRepeatPolicy, todoRepeatSchema } from './todo-repeat.model';

const MONDAY = '2026-11-02';
const WEDNESDAY = '2026-11-04';

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
  end: { type: 'UNTIL', date },
});

const withCount = (repeat: TodoRepeat, count: number): TodoRepeat => ({
  ...repeat,
  end: { type: 'COUNT', count },
});

describe('TodoRepeatPolicy', () => {
  describe('getKind', () => {
    test('월~금 매주는 평일, 7요일 매주는 매일, 격주는 격주로 읽는다', () => {
      // Given
      const weekdays = createWeekly({ weekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI'] });
      const everyDay = createWeekly({
        weekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      });
      const biweekly = createWeekly({ interval: 2 });

      // When
      const kinds = [weekdays, everyDay, biweekly].map(TodoRepeatPolicy.getKind);

      // Then
      expect(kinds).toEqual(['WEEKDAYS', 'DAILY', 'BIWEEKLY']);
    });
  });

  describe('withStartDate', () => {
    test('매월 n일은 새 시작일의 날짜를 따라간다', () => {
      // Given
      const repeat = createMonthly(15);

      // When
      const moved = TodoRepeatPolicy.withStartDate(repeat, '2026-11-15', '2026-12-31');

      // Then
      expect(moved).toMatchObject({ frequency: 'MONTHLY', monthDay: 31 });
    });

    test('시작일 요일만 골랐다면 새 시작일 요일로 옮기고, 직접 고른 요일은 그대로 둔다', () => {
      // Given
      const byDefault = createWeekly({ weekdays: ['MON'] });
      const custom = createWeekly({ weekdays: ['MON', 'FRI'] });

      // When
      const movedDefault = TodoRepeatPolicy.withStartDate(byDefault, MONDAY, WEDNESDAY);
      const movedCustom = TodoRepeatPolicy.withStartDate(custom, MONDAY, WEDNESDAY);

      // Then
      expect(movedDefault).toMatchObject({ weekdays: ['WED'] });
      expect(movedCustom).toMatchObject({ weekdays: ['MON', 'FRI'] });
    });

    test('시작일보다 앞선 종료일은 시작일로 당긴다', () => {
      // Given
      const repeat = withUntil(createWeekly(), '2026-11-10');

      // When
      const moved = TodoRepeatPolicy.withStartDate(repeat, MONDAY, '2026-11-20');

      // Then
      expect(moved.end).toEqual({ type: 'UNTIL', date: '2026-11-20' });
    });
  });

  describe('isMonthDayClamped', () => {
    test('29일부터는 짧은 달 말일 보정 안내 대상이다', () => {
      // Given
      const day28 = createMonthly(28);
      const day29 = createMonthly(29);

      // When
      const results = [day28, day29].map((repeat) => TodoRepeatPolicy.isMonthDayClamped(repeat));

      // Then
      expect(results).toEqual([false, true]);
    });
  });

  describe('createWeeklyUntil', () => {
    test('요일이 없으면 반복이 아니고, 있으면 날짜 종료 매주로 만든다', () => {
      // Given
      const until = '2026-12-31';

      // When
      const empty = TodoRepeatPolicy.createWeeklyUntil([], until);
      const weekly = TodoRepeatPolicy.createWeeklyUntil(['WED', 'MON'], until);

      // Then
      expect(empty).toBeNull();
      expect(weekly).toEqual({
        frequency: 'WEEKLY',
        interval: 1,
        weekdays: ['MON', 'WED'],
        end: { type: 'UNTIL', date: until },
      });
    });
  });

  describe('getOccurrenceDateKeys', () => {
    const NOVEMBER = { from: '2026-11-01', to: '2026-11-30' };

    test('주말이면 시작일 이후의 토·일만 회차다', () => {
      // Given
      const repeat = createWeekly({ weekdays: ['SAT', 'SUN'] });

      // When
      const dates = TodoRepeatPolicy.getOccurrenceDateKeys(repeat, WEDNESDAY, {
        from: '2026-11-01',
        to: '2026-11-15',
      });

      // Then
      expect(dates).toEqual(['2026-11-07', '2026-11-08', '2026-11-14', '2026-11-15']);
    });

    test('매일은 시작일부터 범위 끝까지 전부 회차다', () => {
      // Given
      const repeat = todoRepeatSchema.parse({ frequency: 'DAILY', end: { type: 'NEVER' } });

      // When
      const dates = TodoRepeatPolicy.getOccurrenceDateKeys(repeat, WEDNESDAY, {
        from: '2026-11-01',
        to: '2026-11-06',
      });

      // Then
      expect(dates).toEqual(['2026-11-04', '2026-11-05', '2026-11-06']);
    });

    test('격주는 시작일이 속한 주를 기준으로 한 주씩 건너뛴다', () => {
      // Given
      const repeat = createWeekly({ interval: 2, weekdays: ['MON', 'FRI'] });

      // When
      const dates = TodoRepeatPolicy.getOccurrenceDateKeys(repeat, WEDNESDAY, NOVEMBER);

      // Then
      expect(dates).toEqual(['2026-11-06', '2026-11-16', '2026-11-20', '2026-11-30']);
    });

    test('매월 n일은 그 날이 없는 달이면 말일이다', () => {
      // Given
      const repeat = todoRepeatSchema.parse({
        frequency: 'MONTHLY',
        monthDay: 31,
        end: { type: 'NEVER' },
      });

      // When
      const dates = TodoRepeatPolicy.getOccurrenceDateKeys(repeat, '2026-10-31', {
        from: '2026-10-01',
        to: '2027-03-01',
      });

      // Then
      expect(dates).toEqual(['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
    });

    test('날짜 종료는 종료일을 포함하고 그 뒤는 회차가 아니다', () => {
      // Given
      const repeat = withUntil(createWeekly({ weekdays: ['MON'] }), '2026-11-16');

      // When
      const dates = TodoRepeatPolicy.getOccurrenceDateKeys(repeat, MONDAY, NOVEMBER);

      // Then
      expect(dates).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    });

    test('횟수 종료는 그 횟수에서 멈추고 달을 넘겨도 이어 센다', () => {
      // Given
      const repeat = withCount(createWeekly({ weekdays: ['MON'] }), 3);

      // When
      const dates = TodoRepeatPolicy.getOccurrenceDateKeys(repeat, '2026-11-23', {
        from: '2026-11-30',
        to: '2026-12-31',
      });

      // Then
      expect(dates).toEqual(['2026-11-30', '2026-12-07']);
    });
  });

  describe('getFirstOccurrenceDateKey', () => {
    test('시작일이 회차가 아니면 그 뒤 첫 회차다', () => {
      // Given
      const repeat = createWeekly({ weekdays: ['SAT', 'SUN'] });

      // When
      const first = TodoRepeatPolicy.getFirstOccurrenceDateKey(repeat, WEDNESDAY);

      // Then
      expect(first).toBe('2026-11-07');
    });

    test('종료일 안에 회차가 없으면 null이다', () => {
      // Given
      const repeat = withUntil(createWeekly({ weekdays: ['SAT'] }), '2026-11-06');

      // When
      const first = TodoRepeatPolicy.getFirstOccurrenceDateKey(repeat, WEDNESDAY);

      // Then
      expect(first).toBeNull();
    });
  });

  describe('getLastOccurrenceDateKey', () => {
    test('횟수 종료는 마지막 회차, 끝이 없으면 null이다', () => {
      // Given
      const counted = withCount(createWeekly({ weekdays: ['MON', 'WED'] }), 3);
      const forever = createWeekly();

      // When
      const results = [counted, forever].map((repeat) =>
        TodoRepeatPolicy.getLastOccurrenceDateKey(repeat, MONDAY),
      );

      // Then
      expect(results).toEqual(['2026-11-09', null]);
    });
  });
});

describe('hasSameRepeat', () => {
  test('7요일 매주와 매일, 요일 순서만 다른 매주는 같은 규칙이다', () => {
    // Given
    const allDays: TodoRepeat = {
      frequency: 'WEEKLY',
      interval: 1,
      weekdays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
      end: { type: 'NEVER' },
    };
    const daily: TodoRepeat = { frequency: 'DAILY', end: { type: 'NEVER' } };

    // When
    const result = TodoRepeatPolicy.hasSameRepeat(allDays, daily);

    // Then
    expect(result).toBe(true);
  });

  test('없던 반복을 만들면 다른 규칙이다', () => {
    // When
    const result = TodoRepeatPolicy.hasSameRepeat(null, {
      frequency: 'DAILY',
      end: { type: 'NEVER' },
    });

    // Then
    expect(result).toBe(false);
  });
});

describe('getEditScopeDecision', () => {
  const rule: TodoRepeat = { frequency: 'DAILY', end: { type: 'NEVER' } };

  test.each([
    [{ isSeries: false, isDateOnly: false }, 'not-repeating'],
    [{ isSeries: false, repeat: rule, isDateOnly: false }, 'not-repeating'],
    [{ isSeries: true, repeat: null, isDateOnly: false }, 'not-repeating'],
    [{ isSeries: true, repeat: rule, isDateOnly: false }, 'ask-following-only'],
    [{ isSeries: true, isDateOnly: true }, 'this-only'],
    [{ isSeries: true, isDateOnly: false }, 'ask'],
  ] as const)('%j → %s', (input, expected) => {
    // When
    const decision = TodoRepeatPolicy.getEditScopeDecision(input);

    // Then
    expect(decision).toBe(expected);
  });
});

describe('isBeyondHorizon', () => {
  const TODAY = '2026-11-05';

  test.each([
    ['2026-11-05', false],
    ['2027-02-03', false],
    ['2027-02-04', true],
  ])('오늘 + 90일까지는 미리 만든다: %s → %s', (dateKey, expected) => {
    // When
    const result = TodoRepeatPolicy.isBeyondHorizon(dateKey, TODAY);

    // Then
    expect(result).toBe(expected);
  });

  test.each([
    ['2027-01-15', false],
    ['2027-02-01', true],
    ['2027-03-01', true],
  ])('달의 마지막 날이 넘어가면 그 달은 넘어간 달이다: %s → %s', (dateKey, expected) => {
    // When
    const result = TodoRepeatPolicy.isMonthBeyondHorizon(dateKey, TODAY);

    // Then
    expect(result).toBe(expected);
  });
});
