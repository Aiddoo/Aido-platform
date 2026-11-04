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
});
