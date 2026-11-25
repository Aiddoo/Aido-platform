import { DAY_OF_WEEK_MAP } from '@aido/api/vocabulary';

import {
  CALENDAR_DAYS_OF_WEEK,
  getDaysSinceAggregationWeekStart,
  getDaysSinceCalendarWeekStart,
} from './week-start';

describe('주 시작', () => {
  it('달력은 일요일부터 토요일까지 그린다', () => {
    // When
    const days = CALENDAR_DAYS_OF_WEEK;

    // Then
    expect(days).toEqual(['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
  });

  it.each([
    ['SUN', 0, 6],
    ['MON', 1, 0],
    ['WED', 3, 2],
    ['SAT', 6, 5],
  ] as const)(
    '%s는 달력 주에서 %i일째, 집계 주에서 %i일째다',
    (day, calendarDays, aggregationDays) => {
      // When
      const dayOfWeek = DAY_OF_WEEK_MAP[day];

      // Then
      expect(getDaysSinceCalendarWeekStart(dayOfWeek)).toBe(calendarDays);
      expect(getDaysSinceAggregationWeekStart(dayOfWeek)).toBe(aggregationDays);
    },
  );
});
