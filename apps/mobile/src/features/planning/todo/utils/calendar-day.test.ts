import { range } from 'es-toolkit';

import {
  getDatePickerDayType,
  getMonthViewDayState,
  getRepeatWeekDays,
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

describe('getDatePickerDayType', () => {
  it.each([
    ['선택된 날짜는 항상 selected', input(SUNDAY, true, SUNDAY), 'selected'],
    ['오늘이고 선택되지 않은 날짜는 today', input(MONDAY, false, MONDAY), 'today'],
    ['일요일이고 선택되지 않고 오늘이 아니면 sunday', input(SUNDAY, false), 'sunday'],
    ['토요일이고 선택되지 않고 오늘이 아니면 saturday', input(SATURDAY, false), 'saturday'],
    ['평일이고 선택되지 않고 오늘이 아니면 default', input(MONDAY, false), 'default'],
    ['오늘이 일요일이면 today가 sunday보다 우선', input(SUNDAY, false, SUNDAY), 'today'],
  ])('%s', (_title, params, expected) => {
    // When
    const result = getDatePickerDayType(params);

    // Then
    expect(result).toBe(expected);
  });

  it('자정을 막 넘긴 순간은 서울에서는 월요일, 뉴욕에서는 일요일로 칠한다', () => {
    // Given
    const justAfterMidnightInSeoul = new Date('2025-03-16T15:30:00Z');
    const params = input(justAfterMidnightInSeoul, false);

    // When
    const seoul = getDatePickerDayType(params);
    const newYork = getDatePickerDayType({ ...params, timeZone: 'America/New_York' });

    // Then
    expect(seoul).toBe('default');
    expect(newYork).toBe('sunday');
  });
});

describe('getMonthViewDayState', () => {
  // 2025-03-17 월, 2025-03-22 토, 2025-03-23 일, 2025-03-20 목
  const state = (dateKey: string, selectedDateKey: string, todayKey = '2025-03-20') =>
    getMonthViewDayState({ dateKey, selectedDateKey, todayKey });

  it.each([
    ['선택된 날짜는 항상 selected', state('2025-03-23', '2025-03-23'), 'selected'],
    ['일요일이고 선택되지 않으면 sunday', state('2025-03-23', '2025-03-17'), 'sunday'],
    ['토요일이고 선택되지 않으면 saturday', state('2025-03-22', '2025-03-17'), 'saturday'],
    ['오늘이고 주말이 아니고 선택되지 않으면 today', state('2025-03-20', '2025-03-17'), 'today'],
    ['평일이고 선택되지 않고 오늘이 아니면 default', state('2025-03-17', '2025-03-18'), 'default'],
    [
      '오늘이 일요일이어도 월 달력에서는 sunday가 today보다 우선',
      state('2025-03-23', '2025-03-17', '2025-03-23'),
      'sunday',
    ],
    [
      '오늘이 토요일이어도 월 달력에서는 saturday가 today보다 우선',
      state('2025-03-22', '2025-03-17', '2025-03-22'),
      'saturday',
    ],
  ])('%s', (_title, result, expected) => {
    // Then
    expect(result.dayType).toBe(expected);
  });

  it.each([
    ['오늘이고 선택되지 않으면 오늘을 강조한다', state('2025-03-20', '2025-03-17'), true, false],
    ['오늘이 선택되면 선택으로만 칠한다', state('2025-03-20', '2025-03-20'), false, true],
    ['오늘이 아닌 날은 강조하지 않는다', state('2025-03-18', '2025-03-17'), false, false],
  ])('%s', (_title, result, highlightToday, isSelected) => {
    // Then
    expect(result.highlightToday).toBe(highlightToday);
    expect(result.isSelected).toBe(isSelected);
  });
});

describe('isTodayHighlighted', () => {
  it.each([
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

  it('시작 칸 가운데부터 끝 칸 가운데까지 한 덩어리로 칠한다', () => {
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

  it('주 전체가 기간 안이면 양 끝까지 칠한다', () => {
    // Given
    const days = range(7).map(() => day({ isInRange: true }));

    // When
    const band = getWeekRangeBand(days);

    // Then
    expect(band).toEqual({ startRatio: 0, endRatio: 1 });
  });

  it('기간에 걸리지 않는 주는 띠가 없다', () => {
    // Given
    const days = week({});

    // When
    const band = getWeekRangeBand(days);

    // Then
    expect(band).toBeNull();
  });
});

describe('getRepeatWeekDays', () => {
  const toSeoulDate = (day: number, month = 11) => new Date(Date.UTC(2026, month - 1, day, 3));
  const WEEK = [toSeoulDate(1), toSeoulDate(2), toSeoulDate(3), toSeoulDate(4)];
  const PERIOD = { displayMonth: toSeoulDate(1), timeZone: TIME_ZONE };

  it('시작과 끝 사이의 날만 기간 띠에 넣는다', () => {
    // When
    const days = getRepeatWeekDays(WEEK, {
      ...PERIOD,
      startDate: toSeoulDate(1),
      endDate: toSeoulDate(3),
      isOpenEnded: false,
    });

    // Then
    expect(days.map(({ isInRange }) => isInRange)).toEqual([false, true, false, false]);
    expect(days.map(({ isRangeStart }) => isRangeStart)).toEqual([true, false, false, false]);
    expect(days.map(({ isRangeEnd }) => isRangeEnd)).toEqual([false, false, true, false]);
  });

  it('시작과 끝이 같은 날이면 띠를 그리지 않는다', () => {
    // When
    const days = getRepeatWeekDays(WEEK, {
      ...PERIOD,
      startDate: toSeoulDate(2),
      endDate: toSeoulDate(2),
      isOpenEnded: false,
    });

    // Then
    expect(days.some(({ isInRange, isRangeStart }) => isInRange || isRangeStart)).toBe(false);
    expect(days[1]).toMatchObject({ isStart: true, isEnd: true });
  });

  it('계속 반복은 끝이 없어 시작 뒤 모든 날이 띠에 든다', () => {
    // When
    const days = getRepeatWeekDays(WEEK, {
      ...PERIOD,
      startDate: toSeoulDate(2),
      endDate: null,
      isOpenEnded: true,
    });

    // Then
    expect(days.map(({ isInRange }) => isInRange)).toEqual([false, false, true, true]);
  });

  it('보고 있는 달이 아닌 칸은 띠에 넣지 않는다', () => {
    // When
    const [day] = getRepeatWeekDays([toSeoulDate(31, 10)], {
      ...PERIOD,
      startDate: toSeoulDate(1, 10),
      endDate: null,
      isOpenEnded: true,
    });

    // Then
    expect(day).toMatchObject({ isVisible: false, isInRange: false });
  });
});
