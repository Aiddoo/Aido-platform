import { getCalendarWeek } from './calendar-week';

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
    const week = getCalendarWeek(date);

    // Then
    expect(week.start).toEqual(expectedStart);
    expect(week.weekOfMonth).toBe(expectedWeek);
    expect(week.end.getDay()).toBe(6);
    expect(week.end.getHours()).toBe(23);
    expect(date.getTime()).toBe(originalTimestamp);
  });
});
