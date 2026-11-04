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

  describe('withKind', () => {
    test('종류를 바꿔도 종료 조건은 유지한다', () => {
      // Given
      const repeat = createWeekly({ end: { type: 'COUNT', count: 5 } });

      // When
      const monthly = TodoRepeatPolicy.withKind(repeat, 'MONTHLY', '2026-11-15');

      // Then
      expect(monthly).toEqual({
        frequency: 'MONTHLY',
        monthDay: 15,
        end: { type: 'COUNT', count: 5 },
      });
    });

    test('매주로 처음 바꾸면 시작일 요일 하나를 고른다', () => {
      // Given
      const start = WEDNESDAY;

      // When
      const repeat = TodoRepeatPolicy.create('WEEKLY', start);

      // Then
      expect(repeat).toMatchObject({ frequency: 'WEEKLY', interval: 1, weekdays: ['WED'] });
    });

    test('매주에서 격주로 바꾸면 고른 요일을 유지한다', () => {
      // Given
      const repeat = createWeekly({ weekdays: ['MON', 'FRI'] });

      // When
      const biweekly = TodoRepeatPolicy.withKind(repeat, 'BIWEEKLY', WEDNESDAY);

      // Then
      expect(biweekly).toMatchObject({ interval: 2, weekdays: ['MON', 'FRI'] });
    });
  });

  describe('withWeekdayToggled', () => {
    test('마지막 하나 남은 요일은 끌 수 없다', () => {
      // Given
      const repeat = createWeekly({ weekdays: ['MON'] });

      // When
      const result = TodoRepeatPolicy.withWeekdayToggled(repeat, 'MON');

      // Then
      expect(result).toEqual(repeat);
    });

    test('요일을 켜면 월요일부터 순서대로 정렬한다', () => {
      // Given
      const repeat = createWeekly({ weekdays: ['FRI'] });

      // When
      const result = TodoRepeatPolicy.withWeekdayToggled(repeat, 'MON');

      // Then
      expect(result).toMatchObject({ weekdays: ['MON', 'FRI'] });
    });
  });

  describe('withEndType', () => {
    test('날짜 종료로 바꾸면 시작일 4주 뒤를 기본으로 잡고, 횟수는 기본 10회다', () => {
      // Given
      const repeat = createWeekly();

      // When
      const until = TodoRepeatPolicy.withEndType(repeat, 'UNTIL', '2026-11-02');
      const count = TodoRepeatPolicy.withEndType(repeat, 'COUNT', '2026-11-02');

      // Then
      expect(until.end).toEqual({ type: 'UNTIL', date: '2026-11-30' });
      expect(count.end).toEqual({ type: 'COUNT', count: 10 });
    });

    test('종료 종류를 오가도 이전에 고른 날짜와 횟수를 기억한다', () => {
      // Given
      const counted = TodoRepeatPolicy.withCount(createWeekly(), 7);

      // When
      const back = TodoRepeatPolicy.withEndType(
        TodoRepeatPolicy.withEndType(counted, 'NEVER', MONDAY),
        'COUNT',
        MONDAY,
      );

      // Then
      expect(back.end).toEqual({ type: 'COUNT', count: 10 });
    });
  });

  describe('withCount', () => {
    test('횟수는 2~365회로 맞춘다', () => {
      // Given
      const repeat = createWeekly();

      // When
      const tooFew = TodoRepeatPolicy.withCount(repeat, 1);
      const tooMany = TodoRepeatPolicy.withCount(repeat, 400);

      // Then
      expect([tooFew.end, tooMany.end]).toEqual([
        { type: 'COUNT', count: 2 },
        { type: 'COUNT', count: 365 },
      ]);
    });
  });

  describe('withStartDate', () => {
    test('매월 n일은 새 시작일의 날짜를 따라간다', () => {
      // Given
      const repeat = TodoRepeatPolicy.create('MONTHLY', '2026-11-15');

      // When
      const moved = repeat && TodoRepeatPolicy.withStartDate(repeat, '2026-11-15', '2026-12-31');

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
      const repeat = TodoRepeatPolicy.withUntilDate(createWeekly(), '2026-11-10');

      // When
      const moved = TodoRepeatPolicy.withStartDate(repeat, MONDAY, '2026-11-20');

      // Then
      expect(moved.end).toEqual({ type: 'UNTIL', date: '2026-11-20' });
    });
  });

  describe('isMonthDayClamped', () => {
    test('29일부터는 짧은 달 말일 보정 안내 대상이다', () => {
      // Given
      const day28 = TodoRepeatPolicy.create('MONTHLY', '2026-11-28');
      const day29 = TodoRepeatPolicy.create('MONTHLY', '2026-10-29');

      // When
      const results = [day28, day29].map(
        (repeat) => repeat != null && TodoRepeatPolicy.isMonthDayClamped(repeat),
      );

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
      const repeat = TodoRepeatPolicy.withUntilDate(
        createWeekly({ weekdays: ['MON'] }),
        '2026-11-16',
      );

      // When
      const dates = TodoRepeatPolicy.getOccurrenceDateKeys(repeat, MONDAY, NOVEMBER);

      // Then
      expect(dates).toEqual(['2026-11-02', '2026-11-09', '2026-11-16']);
    });

    test('횟수 종료는 그 횟수에서 멈추고 달을 넘겨도 이어 센다', () => {
      // Given
      const repeat = TodoRepeatPolicy.withCount(createWeekly({ weekdays: ['MON'] }), 3);

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
      const repeat = TodoRepeatPolicy.withUntilDate(
        createWeekly({ weekdays: ['SAT'] }),
        '2026-11-06',
      );

      // When
      const first = TodoRepeatPolicy.getFirstOccurrenceDateKey(repeat, WEDNESDAY);

      // Then
      expect(first).toBeNull();
    });
  });

  describe('getLastOccurrenceDateKey', () => {
    test('횟수 종료는 마지막 회차, 끝이 없으면 null이다', () => {
      // Given
      const counted = TodoRepeatPolicy.withCount(createWeekly({ weekdays: ['MON', 'WED'] }), 3);
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
