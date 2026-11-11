import { i18n } from '@src/shared/i18n';

import {
  diffWeeks,
  getCalendarMonthRanges,
  getWeekStart,
  getMonthWeeks,
  shiftCalendarDate,
} from './calendar-grid';

const SYSTEM_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

afterEach(async () => {
  await i18n.changeLanguage('ko');
});

describe('일요일을 기준으로 한 달력 주', () => {
  it.each([
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
    // Given
    // — 2026년 7월 (5주)
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
    // Given
    // — 2026년 8월 (6주)
    const august = new Date(2026, 7, 1);

    // When
    const weeks = getMonthWeeks(august, SYSTEM_TIME_ZONE);

    // Then
    expect(weeks).toHaveLength(6);
  });
});

describe('getCalendarMonthRanges', () => {
  it('고른 날의 달·앞 달·다음 달을 일요일 시작 주까지 채운 범위로 준다', () => {
    // When
    const ranges = getCalendarMonthRanges('2026-10-26');

    // Then
    expect(ranges).toEqual({
      selected: { startDate: '2026-09-27', endDate: '2026-10-31' },
      neighbors: [
        { startDate: '2026-08-30', endDate: '2026-10-03' },
        { startDate: '2026-11-01', endDate: '2026-12-05' },
      ],
    });
  });

  it('같은 달의 어느 날을 골라도 같은 범위라 달 안에서 날짜를 옮겨도 키가 같다', () => {
    // When
    const first = getCalendarMonthRanges('2026-10-01');
    const last = getCalendarMonthRanges('2026-10-31');

    // Then
    expect(first).toEqual(last);
  });
});

describe('diffWeeks', () => {
  it('같은 주 안이면 0을 반환해야 한다', () => {
    // Given
    // — 2026-04-13(월) 기준 같은 주 목요일
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

    // When
    const next = diffWeeks(nextWeek, base, SYSTEM_TIME_ZONE);
    const previous = diffWeeks(previousWeek, base, SYSTEM_TIME_ZONE);

    // Then
    expect(next).toBe(1);
    expect(previous).toBe(-1);
  });

  it('주 단위로 정규화되므로 요일이 달라도 같은 결과를 반환해야 한다', () => {
    // Given
    // — 2주 차이(서로 다른 요일)
    const base = new Date(2026, 3, 13); // 월
    const twoWeeksLater = new Date(2026, 3, 30); // 목 (2주 + 3일)

    // When
    const result = diffWeeks(twoWeeksLater, base, SYSTEM_TIME_ZONE);

    // Then
    // — startOf('week') 기준이므로 정확히 2
    expect(result).toBe(2);
  });
});

describe('shiftCalendarDate', () => {
  it('주 보기는 선택한 날짜가 속한 주의 시작에서 한 주 이동한다', () => {
    // Given
    const wednesday = new Date(2026, 9, 14);

    // When
    const next = shiftCalendarDate({
      viewMode: 'week',
      date: wednesday,
      step: 1,
      timeZone: SYSTEM_TIME_ZONE,
    });
    const previous = shiftCalendarDate({
      viewMode: 'week',
      date: wednesday,
      step: -1,
      timeZone: SYSTEM_TIME_ZONE,
    });

    // Then
    expect(next).toEqual(new Date(2026, 9, 18));
    expect(previous).toEqual(new Date(2026, 9, 4));
  });

  it('월 보기는 선택한 날짜가 속한 달의 1일에서 한 달 이동한다', () => {
    // Given
    const middleOfMonth = new Date(2026, 9, 14);

    // When
    const next = shiftCalendarDate({
      viewMode: 'month',
      date: middleOfMonth,
      step: 1,
      timeZone: SYSTEM_TIME_ZONE,
    });
    const previous = shiftCalendarDate({
      viewMode: 'month',
      date: middleOfMonth,
      step: -1,
      timeZone: SYSTEM_TIME_ZONE,
    });

    // Then
    expect(next).toEqual(new Date(2026, 10, 1));
    expect(previous).toEqual(new Date(2026, 8, 1));
  });
});
