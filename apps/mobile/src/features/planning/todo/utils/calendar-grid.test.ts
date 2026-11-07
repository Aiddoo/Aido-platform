import { i18n } from '@src/shared/i18n';

import {
  diffMonths,
  diffWeeks,
  getCalendarRange,
  getWeekStart,
  getMonthWeeks,
  getWeekRange,
  shiftCalendarDate,
} from './calendar-grid';

const SYSTEM_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('일요일을 기준으로 한 달력 주', () => {
  test.each([
    [new Date(2026, 9, 3), new Date(2026, 8, 27)],
    [new Date(2026, 9, 4), new Date(2026, 9, 4)],
    [new Date(2027, 0, 1), new Date(2026, 11, 27)],
    [new Date(2028, 1, 29), new Date(2028, 1, 27)],
  ])('날짜 %s의 주는 %s부터 시작한다', (date, expectedStart) => {
    // Given
    const originalTimestamp = date.getTime();

    // When
    const weekStart = getWeekStart(date, SYSTEM_TIME_ZONE);

    // Then
    expect(weekStart).toEqual(expectedStart);
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
    const result = diffMonths(day15, day1, SYSTEM_TIME_ZONE);

    // Then
    expect(result).toBe(0);
  });

  it('다음 달이면 1, 이전 달이면 -1을 반환해야 한다', () => {
    // Given
    const april = new Date(2026, 3, 15);
    const may = new Date(2026, 4, 15);
    const march = new Date(2026, 2, 15);

    // When / Then
    expect(diffMonths(may, april, SYSTEM_TIME_ZONE)).toBe(1);
    expect(diffMonths(march, april, SYSTEM_TIME_ZONE)).toBe(-1);
  });

  it('월말 경계를 넘어도 startOf month 기준으로 정규화되어야 한다', () => {
    // Given — 1/31 vs 2/1: 달력상 하루 차이지만 월 차이는 1
    const jan31 = new Date(2026, 0, 31);
    const feb1 = new Date(2026, 1, 1);

    // When
    const result = diffMonths(feb1, jan31, SYSTEM_TIME_ZONE);

    // Then
    expect(result).toBe(1);
  });
});

describe('shiftCalendarDate', () => {
  test('주 보기는 선택한 날짜가 속한 주의 시작에서 한 주 이동한다', () => {
    const wednesday = new Date(2026, 9, 14);

    expect(
      shiftCalendarDate({ viewMode: 'week', date: wednesday, step: 1, timeZone: SYSTEM_TIME_ZONE }),
    ).toEqual(new Date(2026, 9, 18));
    expect(
      shiftCalendarDate({
        viewMode: 'week',
        date: wednesday,
        step: -1,
        timeZone: SYSTEM_TIME_ZONE,
      }),
    ).toEqual(new Date(2026, 9, 4));
  });

  test('월 보기는 선택한 날짜가 속한 달의 1일에서 한 달 이동한다', () => {
    const middleOfMonth = new Date(2026, 9, 14);

    expect(
      shiftCalendarDate({
        viewMode: 'month',
        date: middleOfMonth,
        step: 1,
        timeZone: SYSTEM_TIME_ZONE,
      }),
    ).toEqual(new Date(2026, 10, 1));
    expect(
      shiftCalendarDate({
        viewMode: 'month',
        date: middleOfMonth,
        step: -1,
        timeZone: SYSTEM_TIME_ZONE,
      }),
    ).toEqual(new Date(2026, 8, 1));
  });
});
