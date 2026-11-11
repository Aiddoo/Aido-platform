import { getDayOfWeek } from '@src/shared/date/date-key';
import { createDateKey } from '@src/testing/date-key';
import { range } from 'es-toolkit';

import {
  getMonthViewDayState,
  getPickerDayType,
  getRepeatWeekDays,
  getWeekRangeBand,
} from './calendar-day';
import type { CalendarDayCell } from './calendar-month.view-model';

const MONDAY = 1;
const SATURDAY = 6;
const SUNDAY = 0;

describe('getPickerDayType', () => {
  it.each([
    [
      '선택된 날짜는 항상 selected',
      { dayOfWeek: SUNDAY, isSelected: true, isToday: true },
      'selected',
    ],
    [
      '오늘이고 선택되지 않은 날짜는 today',
      { dayOfWeek: MONDAY, isSelected: false, isToday: true },
      'today',
    ],
    [
      '일요일이고 선택되지 않고 오늘이 아니면 sunday',
      { dayOfWeek: SUNDAY, isSelected: false, isToday: false },
      'sunday',
    ],
    [
      '토요일이고 선택되지 않고 오늘이 아니면 saturday',
      { dayOfWeek: SATURDAY, isSelected: false, isToday: false },
      'saturday',
    ],
    [
      '평일이고 선택되지 않고 오늘이 아니면 default',
      { dayOfWeek: MONDAY, isSelected: false, isToday: false },
      'default',
    ],
    [
      '오늘이 일요일이면 today가 sunday보다 우선',
      { dayOfWeek: SUNDAY, isSelected: false, isToday: true },
      'today',
    ],
  ])('%s', (_title, params, expected) => {
    // When
    const result = getPickerDayType(params);

    // Then
    expect(result).toBe(expected);
  });
});

describe('getMonthViewDayState', () => {
  // 2025-03-17 월, 2025-03-22 토, 2025-03-23 일, 2025-03-20 목
  const keys = (dateKey: string, selectedDateKey: string, todayKey = '2025-03-20') => ({
    dateKey: createDateKey(dateKey),
    dayOfWeek: getDayOfWeek(createDateKey(dateKey)),
    selectedDateKey: createDateKey(selectedDateKey),
    todayKey: createDateKey(todayKey),
  });

  it.each([
    ['선택된 날짜는 항상 selected', keys('2025-03-23', '2025-03-23'), 'selected'],
    ['일요일이고 선택되지 않으면 sunday', keys('2025-03-23', '2025-03-17'), 'sunday'],
    ['토요일이고 선택되지 않으면 saturday', keys('2025-03-22', '2025-03-17'), 'saturday'],
    ['오늘이고 주말이 아니고 선택되지 않으면 today', keys('2025-03-20', '2025-03-17'), 'today'],
    ['평일이고 선택되지 않고 오늘이 아니면 default', keys('2025-03-17', '2025-03-18'), 'default'],
    [
      '오늘이 일요일이어도 월 달력에서는 sunday가 today보다 우선',
      keys('2025-03-23', '2025-03-17', '2025-03-23'),
      'sunday',
    ],
    [
      '오늘이 토요일이어도 월 달력에서는 saturday가 today보다 우선',
      keys('2025-03-22', '2025-03-17', '2025-03-22'),
      'saturday',
    ],
  ])('%s', (_title, params, expected) => {
    // When
    const result = getMonthViewDayState(params);

    // Then
    expect(result.dayType).toBe(expected);
  });

  it.each([
    ['오늘이고 선택되지 않으면 오늘을 강조한다', keys('2025-03-20', '2025-03-17'), true, false],
    ['오늘이 선택되면 선택으로만 칠한다', keys('2025-03-20', '2025-03-20'), false, true],
    ['오늘이 아닌 날은 강조하지 않는다', keys('2025-03-18', '2025-03-17'), false, false],
  ])('%s', (_title, params, isTodayHighlighted, isSelected) => {
    // When
    const result = getMonthViewDayState(params);

    // Then
    expect(result.isTodayHighlighted).toBe(isTodayHighlighted);
    expect(result.isSelected).toBe(isSelected);
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
  const cell = (dateKey: string, isOutsideMonth = false): CalendarDayCell => ({
    dateKey: createDateKey(dateKey),
    dayNumber: String(Number(dateKey.slice(-2))),
    label: dateKey,
    dayOfWeek: getDayOfWeek(createDateKey(dateKey)),
    isOutsideMonth,
  });
  const WEEK = ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map((dateKey) =>
    cell(dateKey),
  );

  it('시작과 끝 사이의 날만 기간 띠에 넣는다', () => {
    // When
    const days = getRepeatWeekDays(WEEK, {
      startDateKey: createDateKey('2026-11-01'),
      endDateKey: createDateKey('2026-11-03'),
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
      startDateKey: createDateKey('2026-11-02'),
      endDateKey: createDateKey('2026-11-02'),
      isOpenEnded: false,
    });

    // Then
    expect(days.some(({ isInRange, isRangeStart }) => isInRange || isRangeStart)).toBe(false);
    expect(days[1]).toMatchObject({ isStart: true, isEnd: true });
  });

  it('계속 반복은 끝이 없어 시작 뒤 모든 날이 띠에 든다', () => {
    // When
    const days = getRepeatWeekDays(WEEK, {
      startDateKey: createDateKey('2026-11-02'),
      endDateKey: null,
      isOpenEnded: true,
    });

    // Then
    expect(days.map(({ isInRange }) => isInRange)).toEqual([false, false, true, true]);
  });

  it('보고 있는 달이 아닌 칸은 띠에 넣지 않는다', () => {
    // When
    const [day] = getRepeatWeekDays([cell('2026-10-31', true)], {
      startDateKey: createDateKey('2026-10-01'),
      endDateKey: null,
      isOpenEnded: true,
    });

    // Then
    expect(day).toMatchObject({ isVisible: false, isInRange: false });
  });
});
