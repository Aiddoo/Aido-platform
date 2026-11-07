import { i18n } from '@src/shared/i18n';

import {
  diffMonths,
  diffWeeks,
  getCalendarRange,
  getCalendarWeekBounds,
  getMonthWeeks,
  getWeekRange,
  isAfterDay,
  isBeforeDay,
  isDateToday,
  isSameDay,
  shiftCalendarDate,
} from './calendar-date';

const SYSTEM_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const SEOUL = 'Asia/Seoul';
const NEW_YORK = 'America/New_York';
const LOS_ANGELES = 'America/Los_Angeles';

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('일요일을 기준으로 한 달력 주', () => {
  test.each([
    [new Date(2026, 9, 3), new Date(2026, 8, 27), 4],
    [new Date(2026, 9, 4), new Date(2026, 9, 4), 1],
    [new Date(2027, 0, 1), new Date(2026, 11, 27), 4],
    [new Date(2028, 1, 29), new Date(2028, 1, 27), 4],
  ])('날짜 %s의 주는 %s부터 시작하는 %s주차다', (date, expectedStart, expectedWeek) => {
    // Given
    const originalTimestamp = date.getTime();

    // When
    const week = getCalendarWeekBounds(date, SYSTEM_TIME_ZONE);

    // Then
    expect(week.start).toEqual(expectedStart);
    expect(week.weekOfMonth).toBe(expectedWeek);
    expect(week.end.getDay()).toBe(6);
    expect(week.end.getHours()).toBe(23);
    expect(date.getTime()).toBe(originalTimestamp);
  });
});

describe('getMonthWeeks', () => {
  it('5주짜리 달은 5주를 반환해야 한다', () => {
    // Given — 2026년 7월 (5주)
    const july = new Date(2026, 6, 1);

    // When
    const weeks = getMonthWeeks(july, SYSTEM_TIME_ZONE);

    // Then
    expect(weeks).toHaveLength(5);
  });

  it('각 주는 7일이어야 한다', () => {
    // Given
    const april = new Date(2026, 3, 1);

    // When
    const weeks = getMonthWeeks(april, SYSTEM_TIME_ZONE);

    // Then
    for (const week of weeks) {
      expect(week).toHaveLength(7);
    }
  });

  it('6주짜리 달은 6주를 반환해야 한다', () => {
    // Given — 2026년 8월 (6주)
    const august = new Date(2026, 7, 1);

    // When
    const weeks = getMonthWeeks(august, SYSTEM_TIME_ZONE);

    // Then
    expect(weeks).toHaveLength(6);
  });
});

describe('표시 언어와 무관한 달력 범위', () => {
  test.each(['ko', 'en'] as const)('%s에서도 주·월 범위는 일요일 시작이다', async (language) => {
    // Given
    await i18n.changeLanguage(language);
    const monday = new Date(2026, 9, 26);

    // When
    const weekRange = getWeekRange(monday, SYSTEM_TIME_ZONE);
    const monthRange = getCalendarRange(monday, SYSTEM_TIME_ZONE);
    const [firstWeek] = getMonthWeeks(monday, SYSTEM_TIME_ZONE);

    // Then
    expect(weekRange).toEqual({ rangeStart: '2026-10-25', rangeEnd: '2026-10-31' });
    expect(monthRange).toEqual({ rangeStart: '2026-09-27', rangeEnd: '2026-10-31' });
    expect(firstWeek?.[0]).toEqual(new Date(2026, 8, 27));
  });
});

describe('diffWeeks', () => {
  it('같은 주 안이면 0을 반환해야 한다', () => {
    // Given — 2026-04-13(월) 기준 같은 주 목요일
    const monday = new Date(2026, 3, 13);
    const thursday = new Date(2026, 3, 16);

    // When
    const result = diffWeeks(thursday, monday, SYSTEM_TIME_ZONE);

    // Then
    expect(result).toBe(0);
  });

  it('다음 주면 1, 이전 주면 -1을 반환해야 한다', () => {
    // Given
    const base = new Date(2026, 3, 13);
    const nextWeek = new Date(2026, 3, 20);
    const previousWeek = new Date(2026, 3, 6);

    // When / Then
    expect(diffWeeks(nextWeek, base, SYSTEM_TIME_ZONE)).toBe(1);
    expect(diffWeeks(previousWeek, base, SYSTEM_TIME_ZONE)).toBe(-1);
  });

  it('주 단위로 정규화되므로 요일이 달라도 같은 결과를 반환해야 한다', () => {
    // Given — 2주 차이(서로 다른 요일)
    const base = new Date(2026, 3, 13); // 월
    const twoWeeksLater = new Date(2026, 3, 30); // 목 (2주 + 3일)

    // When
    const result = diffWeeks(twoWeeksLater, base, SYSTEM_TIME_ZONE);

    // Then — startOf('week') 기준이므로 정확히 2
    expect(result).toBe(2);
  });
});

describe('diffMonths', () => {
  it('같은 달 안이면 0을 반환해야 한다', () => {
    // Given
    const day1 = new Date(2026, 3, 1);
    const day15 = new Date(2026, 3, 15);

    // When
    const result = diffMonths(day15, day1);

    // Then
    expect(result).toBe(0);
  });

  it('다음 달이면 1, 이전 달이면 -1을 반환해야 한다', () => {
    // Given
    const april = new Date(2026, 3, 15);
    const may = new Date(2026, 4, 15);
    const march = new Date(2026, 2, 15);

    // When / Then
    expect(diffMonths(may, april)).toBe(1);
    expect(diffMonths(march, april)).toBe(-1);
  });

  it('월말 경계를 넘어도 startOf month 기준으로 정규화되어야 한다', () => {
    // Given — 1/31 vs 2/1: 달력상 하루 차이지만 월 차이는 1
    const jan31 = new Date(2026, 0, 31);
    const feb1 = new Date(2026, 1, 1);

    // When
    const result = diffMonths(feb1, jan31);

    // Then
    expect(result).toBe(1);
  });
});

describe('시간대에 따라 달라지는 날', () => {
  test('자정을 막 넘긴 서울의 순간은 로스앤젤레스에서는 전날이다', () => {
    // Given
    const justAfterMidnightInSeoul = new Date('2026-11-06T15:30:00Z');
    const seoulNoon = new Date('2026-11-06T09:00:00Z');

    // When
    const seoul = isSameDay(justAfterMidnightInSeoul, seoulNoon, SEOUL);
    const losAngeles = isSameDay(justAfterMidnightInSeoul, seoulNoon, LOS_ANGELES);

    // Then
    expect(seoul).toBe(false);
    expect(losAngeles).toBe(true);
  });

  test('시간대를 바꾸면 같은 순간의 오늘 판정이 새 시간대 기준으로 다시 된다', () => {
    // Given
    const now = new Date('2026-11-07T10:00:00Z');
    const instant = new Date('2026-11-07T16:00:00Z');

    // When
    const inSeoul = isDateToday(instant, now, SEOUL);
    const inNewYork = isDateToday(instant, now, NEW_YORK);

    // Then
    expect(inSeoul).toBe(false);
    expect(inNewYork).toBe(true);
  });

  test('날짜 앞뒤 비교도 주어진 시간대의 날짜로 한다', () => {
    // Given
    const instant = new Date('2026-11-06T15:30:00Z');
    const reference = new Date('2026-11-06T09:00:00Z');

    // When / Then
    expect(isAfterDay(instant, reference, SEOUL)).toBe(true);
    expect(isAfterDay(instant, reference, NEW_YORK)).toBe(false);
    expect(isBeforeDay(instant, reference, NEW_YORK)).toBe(false);
  });

  test('서머타임이 시작되는 주도 일요일부터 토요일까지 7일이다', () => {
    // Given
    const springForwardDay = new Date('2026-03-08T12:00:00Z');

    // When
    const range = getWeekRange(springForwardDay, NEW_YORK);

    // Then
    expect(range).toEqual({ rangeStart: '2026-03-08', rangeEnd: '2026-03-14' });
  });

  test('서머타임이 끝나는 날 새벽의 순간도 같은 날짜 주에 속한다', () => {
    // Given
    const fallBackNight = new Date('2026-11-01T05:30:00Z');

    // When
    const range = getWeekRange(fallBackNight, NEW_YORK);

    // Then
    expect(range).toEqual({ rangeStart: '2026-11-01', rangeEnd: '2026-11-07' });
  });
});

describe('shiftCalendarDate', () => {
  test('주 보기는 선택한 날짜가 속한 주의 시작에서 한 주 이동한다', () => {
    const wednesday = new Date(2026, 9, 14);

    expect(shiftCalendarDate('week', wednesday, 1, SYSTEM_TIME_ZONE)).toEqual(
      new Date(2026, 9, 18),
    );
    expect(shiftCalendarDate('week', wednesday, -1, SYSTEM_TIME_ZONE)).toEqual(
      new Date(2026, 9, 4),
    );
  });

  test('월 보기는 선택한 날짜가 속한 달의 1일에서 한 달 이동한다', () => {
    const middleOfMonth = new Date(2026, 9, 14);

    expect(shiftCalendarDate('month', middleOfMonth, 1, SYSTEM_TIME_ZONE)).toEqual(
      new Date(2026, 10, 1),
    );
    expect(shiftCalendarDate('month', middleOfMonth, -1, SYSTEM_TIME_ZONE)).toEqual(
      new Date(2026, 8, 1),
    );
  });
});
