import { range } from 'es-toolkit';

import {
  getDatePickerDayStyle,
  getMonthViewDayStyle,
  getWeekRangeBand,
  isTodayHighlighted,
} from './calendar-day';

const TIME_ZONE = 'Asia/Seoul';
const MONDAY = new Date('2025-03-17T03:00:00Z');
const SATURDAY = new Date('2025-03-22T03:00:00Z');
const SUNDAY = new Date('2025-03-23T03:00:00Z');
const OTHER_DAY = new Date('2025-03-20T03:00:00Z');

const input = (date: Date, isSelected: boolean, today: Date = OTHER_DAY) => ({
  date,
  isSelected,
  today,
  timeZone: TIME_ZONE,
});

describe('getDatePickerDayStyle', () => {
  test.each([
    ['선택된 날짜는 항상 selected', input(SUNDAY, true, SUNDAY), 'selected'],
    ['오늘이고 선택되지 않은 날짜는 today', input(MONDAY, false, MONDAY), 'today'],
    ['일요일이고 선택되지 않고 오늘이 아니면 sunday', input(SUNDAY, false), 'sunday'],
    ['토요일이고 선택되지 않고 오늘이 아니면 saturday', input(SATURDAY, false), 'saturday'],
    ['평일이고 선택되지 않고 오늘이 아니면 default', input(MONDAY, false), 'default'],
    ['오늘이 일요일이면 today가 sunday보다 우선', input(SUNDAY, false, SUNDAY), 'today'],
  ])('%s', (_title, params, expected) => {
    // When
    const result = getDatePickerDayStyle(params);

    // Then
    expect(result).toBe(expected);
  });

  test('자정을 막 넘긴 순간은 서울에서는 월요일, 뉴욕에서는 일요일로 칠한다', () => {
    // Given
    const justAfterMidnightInSeoul = new Date('2025-03-16T15:30:00Z');
    const params = input(justAfterMidnightInSeoul, false);

    // When
    const seoul = getDatePickerDayStyle(params);
    const newYork = getDatePickerDayStyle({ ...params, timeZone: 'America/New_York' });

    // Then
    expect(seoul).toBe('default');
    expect(newYork).toBe('sunday');
  });
});

describe('getMonthViewDayStyle', () => {
  test.each([
    ['선택된 날짜는 항상 selected', input(SUNDAY, true), 'selected'],
    ['일요일이고 선택되지 않으면 sunday', input(SUNDAY, false), 'sunday'],
    ['토요일이고 선택되지 않으면 saturday', input(SATURDAY, false), 'saturday'],
    ['오늘이고 주말이 아니고 선택되지 않으면 today', input(MONDAY, false, MONDAY), 'today'],
    ['평일이고 선택되지 않고 오늘이 아니면 default', input(MONDAY, false), 'default'],
    [
      '오늘이 일요일이어도 월 달력에서는 sunday가 today보다 우선',
      input(SUNDAY, false, SUNDAY),
      'sunday',
    ],
    [
      '오늘이 토요일이어도 월 달력에서는 saturday가 today보다 우선',
      input(SATURDAY, false, SATURDAY),
      'saturday',
    ],
  ])('%s', (_title, params, expected) => {
    // When
    const result = getMonthViewDayStyle(params);

    // Then
    expect(result).toBe(expected);
  });
});

describe('isTodayHighlighted', () => {
  test.each([
    ['오늘이고 선택되지 않은 경우 true', input(MONDAY, false, MONDAY), true],
    ['오늘이지만 선택된 경우 false', input(MONDAY, true, MONDAY), false],
    ['오늘이 아니고 선택되지 않은 경우 false', input(MONDAY, false), false],
    ['오늘이 아니고 선택된 경우 false', input(MONDAY, true), false],
  ])('%s', (_title, params, expected) => {
    // When
    const result = isTodayHighlighted(params);

    // Then
    expect(result).toBe(expected);
  });
});

describe('getWeekRangeBand', () => {
  const day = (overrides: Partial<Parameters<typeof getWeekRangeBand>[0][number]> = {}) => ({
    isInRange: false,
    isRangeStart: false,
    isRangeEnd: false,
    ...overrides,
  });
  const week = (overrides: Record<number, Parameters<typeof day>[0]>) =>
    range(7).map((index) => day(overrides[index]));

  test('시작 칸 가운데부터 끝 칸 가운데까지 한 덩어리로 칠한다', () => {
    // Given
    const days = week({
      1: { isRangeStart: true },
      2: { isInRange: true },
      3: { isRangeEnd: true },
    });

    // When
    const band = getWeekRangeBand(days);

    // Then
    expect(band).toEqual({ startRatio: 1.5 / 7, endRatio: 3.5 / 7 });
  });

  test('주 전체가 기간 안이면 양 끝까지 칠한다', () => {
    // Given
    const days = range(7).map(() => day({ isInRange: true }));

    // When
    const band = getWeekRangeBand(days);

    // Then
    expect(band).toEqual({ startRatio: 0, endRatio: 1 });
  });

  test('기간에 걸리지 않는 주는 띠가 없다', () => {
    // Given
    const days = week({});

    // When
    const band = getWeekRangeBand(days);

    // Then
    expect(band).toBeNull();
  });
});
